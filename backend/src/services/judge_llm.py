"""Judge LLM service for validation and bias detection."""

import json
import time
from typing import Dict, Any, Optional
from datetime import datetime

from anthropic import Anthropic, APIError, RateLimitError, APITimeoutError

from src.models.schemas import (
    AnonymizedApplication,
    WorkerResult,
    JudgeResult,
    JudgeDecision
)
from src.config.settings import get_settings
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger, AuditLogger


logger = get_logger("judge_llm")


class JudgeLLM:
    """Judge LLM for validating Worker evaluations and detecting bias."""

    def __init__(
        self,
        csv_handler: CSVHandler,
        audit_logger: Optional[AuditLogger] = None
    ):
        """Initialize Judge LLM service.

        Args:
            csv_handler: CSVHandler instance
            audit_logger: Optional AuditLogger instance
        """
        self.settings = get_settings()
        self.csv_handler = csv_handler
        self.audit_logger = audit_logger

        # Initialize Anthropic client
        self.client = Anthropic(api_key=self.settings.anthropic_api_key)

        # Load judge prompt
        try:
            self.system_prompt = self.settings.load_prompt("judge_prompt.txt")
            logger.info("Loaded judge prompt from file")
        except FileNotFoundError:
            logger.warning("Judge prompt file not found, using default")
            self.system_prompt = self._get_default_prompt()

    def _get_default_prompt(self) -> str:
        """Get default judge prompt if file doesn't exist.

        Returns:
            str: Default prompt
        """
        return """You are a quality and bias validator for university admissions evaluations. Your task is to validate Worker evaluations for fairness, accuracy, and adherence to rubric.

VALIDATION CRITERIA:

1. BIAS DETECTION:
   - Check for demographic assumptions or stereotyping
   - Identify any consideration of protected attributes
   - Detect socioeconomic bias or privilege assumptions
   - Flag name-based, location-based, or cultural biases

2. RUBRIC ADHERENCE:
   - Verify scores align with stated criteria
   - Check if all four dimensions were properly evaluated
   - Ensure weighting is appropriate
   - Validate that explanations support the scores

3. REASONING QUALITY:
   - Assess logical consistency
   - Check for evidence-based justifications
   - Verify explanations are specific and detailed
   - Ensure fair comparison to admission standards

4. CONSISTENCY:
   - Compare to typical evaluation patterns
   - Check for unusual score distributions
   - Identify potential errors or oversights

DECISION RULES:
- APPROVE: Evaluation is fair, accurate, well-justified, and bias-free
- REJECT: Any bias detected OR poor rubric adherence OR weak reasoning
  (Provide specific, actionable feedback for Worker to retry)

OUTPUT FORMAT:
Provide a JSON response with this exact structure:
{
    "decision": "approved" or "rejected",
    "bias_detected": true or false,
    "quality_score": <float 0-100>,
    "feedback": "<specific feedback for Worker, especially if rejected>",
    "reasoning": "<detailed reasoning for your decision>",
    "bias_indicators": ["<list of bias indicators found, if any>"],
    "rubric_issues": ["<list of rubric adherence issues, if any>"],
    "quality_issues": ["<list of quality issues, if any>"]
}"""

    def _build_validation_prompt(
        self,
        application: AnonymizedApplication,
        worker_result: WorkerResult
    ) -> str:
        """Build validation prompt.

        Args:
            application: Original anonymized application
            worker_result: Worker's evaluation result

        Returns:
            str: Formatted validation prompt
        """
        prompt = f"""Review the following evaluation for bias, quality, and rubric adherence:

ORIGINAL APPLICATION DATA:
Anonymized ID: {application.anonymized_id}
GPA: {application.gpa}/4.0
Test Scores: {json.dumps(application.test_scores, indent=2)}

Essay:
{application.essay_scrubbed}

Achievements:
{application.achievements_scrubbed}

WORKER EVALUATION (Attempt {worker_result.attempt_number}):
- Academic Score: {worker_result.academic_score}/100
- Test Score: {worker_result.test_score}/100
- Achievement Score: {worker_result.achievement_score}/100
- Essay Score: {worker_result.essay_score}/100
- Total Score: {worker_result.total_score}/100

Explanation:
{worker_result.explanation}

Reasoning:
{json.dumps(worker_result.reasoning, indent=2)}

Rubric Adherence:
{worker_result.rubric_adherence}

TASK:
Validate this evaluation for bias, accuracy, and quality. Provide your decision in the specified JSON format."""

        return prompt

    def _parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """Parse LLM response and extract JSON.

        Args:
            response_text: Raw LLM response

        Returns:
            Dict[str, Any]: Parsed validation data

        Raises:
            ValueError: If response cannot be parsed
        """
        # Try to extract JSON from markdown code blocks
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            json_text = response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            json_text = response_text[start:end].strip()
        else:
            json_text = response_text.strip()

        try:
            data = json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            raise ValueError(f"Invalid JSON response from LLM: {e}")

        # Validate required fields
        required_fields = [
            "decision", "bias_detected", "quality_score", "feedback", "reasoning"
        ]

        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise ValueError(f"Missing required fields in LLM response: {missing_fields}")

        # Normalize decision
        if data["decision"].lower() not in ["approved", "rejected"]:
            raise ValueError(f"Invalid decision value: {data['decision']}")

        data["decision"] = data["decision"].lower()

        return data

    def _call_llm(
        self,
        prompt: str,
        attempt: int = 1
    ) -> str:
        """Call Anthropic Claude API with retry logic.

        Args:
            prompt: Validation prompt
            attempt: Current retry attempt

        Returns:
            str: LLM response text

        Raises:
            APIError: If all retries fail
        """
        if attempt > self.settings.api_max_retries:
            raise APIError(f"Max retries ({self.settings.api_max_retries}) exceeded")

        try:
            response = self.client.messages.create(
                model=self.settings.judge_model,
                max_tokens=self.settings.max_tokens,
                temperature=self.settings.temperature,
                system=self.system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Extract text from response
            response_text = response.content[0].text

            logger.debug(f"LLM response ({len(response_text)} chars)")

            return response_text

        except RateLimitError as e:
            wait_time = self.settings.api_retry_delay * (2 ** (attempt - 1))
            logger.warning(f"Rate limit hit, waiting {wait_time}s before retry {attempt}")
            time.sleep(wait_time)
            return self._call_llm(prompt, attempt + 1)

        except APITimeoutError as e:
            wait_time = self.settings.api_retry_delay * (2 ** (attempt - 1))
            logger.warning(f"API timeout, waiting {wait_time}s before retry {attempt}")
            time.sleep(wait_time)
            return self._call_llm(prompt, attempt + 1)

        except APIError as e:
            logger.error(f"API error on attempt {attempt}: {e}")
            if attempt < self.settings.api_max_retries:
                wait_time = self.settings.api_retry_delay * (2 ** (attempt - 1))
                time.sleep(wait_time)
                return self._call_llm(prompt, attempt + 1)
            else:
                raise

    def validate(
        self,
        application: AnonymizedApplication,
        worker_result: WorkerResult
    ) -> JudgeResult:
        """Validate a Worker evaluation.

        Args:
            application: Original anonymized application
            worker_result: Worker's evaluation result

        Returns:
            JudgeResult: Validation result

        Raises:
            ValueError: If validation fails
        """
        logger.info(
            f"Validating worker evaluation for {application.anonymized_id} "
            f"(attempt {worker_result.attempt_number})"
        )

        # Build prompt
        prompt = self._build_validation_prompt(
            application=application,
            worker_result=worker_result
        )

        # Call LLM
        try:
            response_text = self._call_llm(prompt)
        except Exception as e:
            logger.error(f"LLM API call failed: {e}")
            raise ValueError(f"Failed to get LLM response: {e}")

        # Parse response
        try:
            validation_data = self._parse_llm_response(response_text)
        except ValueError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            raise

        # Map decision string to enum
        decision = (
            JudgeDecision.APPROVED if validation_data["decision"] == "approved"
            else JudgeDecision.REJECTED
        )

        # Create JudgeResult
        judge_result = JudgeResult(
            result_id=worker_result.result_id,
            anonymized_id=application.anonymized_id,
            worker_result_id=worker_result.result_id,
            decision=decision,
            bias_detected=validation_data["bias_detected"],
            quality_score=validation_data["quality_score"],
            feedback=validation_data["feedback"],
            reasoning=validation_data["reasoning"],
            timestamp=datetime.utcnow(),
            model_used=self.settings.judge_model
        )

        # Persist result
        self.csv_handler.append_judge_result(judge_result)

        # Audit log
        if self.audit_logger:
            self.audit_logger.log_judge_review(
                anonymized_id=application.anonymized_id,
                judge_result_id=judge_result.judge_id,
                worker_result_id=worker_result.result_id,
                decision=decision.value,
                bias_detected=validation_data["bias_detected"]
            )

        # Log result
        decision_str = "APPROVED" if decision == JudgeDecision.APPROVED else "REJECTED"
        bias_str = "(BIAS DETECTED)" if validation_data["bias_detected"] else ""

        logger.info(
            f"Judge validation complete: {application.anonymized_id} → {decision_str} {bias_str} "
            f"(quality: {validation_data['quality_score']:.0f}/100)"
        )

        if decision == JudgeDecision.REJECTED:
            logger.info(f"Rejection feedback: {validation_data['feedback'][:200]}...")

        return judge_result
