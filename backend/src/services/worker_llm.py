"""Worker LLM service for merit evaluation."""

import json
import time
from typing import Dict, Any, Optional
from datetime import datetime

from openai import OpenAI, APIError, RateLimitError, APITimeoutError

from src.models.schemas import AnonymizedApplication, WorkerResult
from src.config.settings import get_settings
from src.utils.csv_handler import CSVHandler
from src.utils.logger import get_logger, AuditLogger


logger = get_logger("worker_llm")


class WorkerLLM:
    """Worker LLM for merit-based evaluation of anonymized applications using GPT-5."""

    def __init__(
        self,
        csv_handler: CSVHandler,
        audit_logger: Optional[AuditLogger] = None
    ):
        """Initialize Worker LLM service.

        Args:
            csv_handler: CSVHandler instance
            audit_logger: Optional AuditLogger instance
        """
        self.settings = get_settings()
        self.csv_handler = csv_handler
        self.audit_logger = audit_logger

        # Initialize OpenAI client
        self.client = OpenAI(api_key=self.settings.openai_api_key)

        # Load worker prompt
        try:
            self.system_prompt = self.settings.load_prompt("worker_prompt.txt")
            logger.info("Loaded worker prompt from file")
        except FileNotFoundError:
            logger.warning("Worker prompt file not found, using default")
            self.system_prompt = self._get_default_prompt()

    def _get_default_prompt(self) -> str:
        """Get default worker prompt if file doesn't exist.

        Returns:
            str: Default prompt
        """
        return """You are a university admissions merit evaluator. Your task is to evaluate anonymized applications based solely on academic merit.

EVALUATION CRITERIA:
1. Academic Performance (0-100): GPA, coursework rigor, academic trajectory
2. Test Scores (0-100): Standardized test results and their context
3. Achievements (0-100): Awards, competitions, projects, research, leadership
4. Essay Quality (0-100): Writing quality, critical thinking, intellectual curiosity, motivation

IMPORTANT CONSTRAINTS:
- Ignore any residual demographic information or identity markers
- Focus exclusively on merit indicators
- Do not penalize applicants for lack of privileged opportunities
- Evaluate essay content and reasoning, not writing style that may reflect background
- Be consistent and fair across all evaluations

OUTPUT FORMAT:
Provide a JSON response with this exact structure:
{
    "academic_score": <float 0-100>,
    "test_score": <float 0-100>,
    "achievement_score": <float 0-100>,
    "essay_score": <float 0-100>,
    "total_score": <float 0-100>,
    "explanation": "<comprehensive evaluation summary>",
    "reasoning": {
        "academic": "<academic performance analysis>",
        "test": "<test scores analysis>",
        "achievement": "<achievements analysis>",
        "essay": "<essay quality analysis>"
    },
    "rubric_adherence": "<explanation of how rubric was applied>"
}

The total_score should be a weighted average:
- Academic: 30%
- Test: 25%
- Achievement: 25%
- Essay: 20%"""

    def _build_evaluation_prompt(
        self,
        application: AnonymizedApplication,
        attempt_number: int,
        feedback: Optional[str] = None
    ) -> str:
        """Build evaluation prompt for the application.

        Args:
            application: Anonymized application to evaluate
            attempt_number: Current attempt number
            feedback: Optional feedback from previous Judge review

        Returns:
            str: Formatted evaluation prompt
        """
        prompt = f"""Evaluate the following anonymized application:

ANONYMIZED ID: {application.anonymized_id}

ACADEMIC DATA:
- GPA: {application.gpa}/4.0
- Test Scores: {json.dumps(application.test_scores, indent=2)}

ESSAY:
{application.essay_scrubbed}

ACHIEVEMENTS:
{application.achievements_scrubbed}
"""

        if attempt_number > 1 and feedback:
            prompt += f"""
FEEDBACK FROM PREVIOUS ATTEMPT:
This is attempt #{attempt_number}. Please address the following feedback:
{feedback}
"""

        prompt += "\nProvide your evaluation in the specified JSON format."

        return prompt

    def _parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """Parse LLM response and extract JSON.

        Args:
            response_text: Raw LLM response

        Returns:
            Dict[str, Any]: Parsed evaluation data

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
            "academic_score", "test_score", "achievement_score", "essay_score",
            "total_score", "explanation", "reasoning", "rubric_adherence"
        ]

        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise ValueError(f"Missing required fields in LLM response: {missing_fields}")

        # Validate reasoning sub-fields
        if not isinstance(data["reasoning"], dict):
            raise ValueError("reasoning must be a dictionary")

        required_reasoning = ["academic", "test", "achievement", "essay"]
        missing_reasoning = [field for field in required_reasoning if field not in data["reasoning"]]
        if missing_reasoning:
            raise ValueError(f"Missing reasoning fields: {missing_reasoning}")

        return data

    def _call_llm(
        self,
        prompt: str,
        attempt: int = 1
    ) -> str:
        """Call OpenAI GPT API with retry logic.

        Args:
            prompt: Evaluation prompt
            attempt: Current retry attempt

        Returns:
            str: LLM response text

        Raises:
            APIError: If all retries fail
        """
        if attempt > self.settings.api_max_retries:
            raise APIError(f"Max retries ({self.settings.api_max_retries}) exceeded")

        try:
            # Note: GPT-5 series does not support temperature, max_tokens, or max_completion_tokens parameters
            response = self.client.chat.completions.create(
                model=self.settings.worker_model,
                messages=[
                    {
                        "role": "system",
                        "content": self.system_prompt
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Extract text from response
            response_text = response.choices[0].message.content

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

    def evaluate(
        self,
        application: AnonymizedApplication,
        attempt_number: int = 1,
        judge_feedback: Optional[str] = None
    ) -> WorkerResult:
        """Evaluate an anonymized application.

        Args:
            application: Anonymized application to evaluate
            attempt_number: Evaluation attempt number (1-indexed)
            judge_feedback: Optional feedback from Judge if this is a retry

        Returns:
            WorkerResult: Evaluation result

        Raises:
            ValueError: If evaluation fails
        """
        logger.info(
            f"Evaluating {application.anonymized_id} (attempt {attempt_number})"
        )

        # Build prompt
        prompt = self._build_evaluation_prompt(
            application=application,
            attempt_number=attempt_number,
            feedback=judge_feedback
        )

        # Call LLM
        try:
            response_text = self._call_llm(prompt)
        except Exception as e:
            logger.error(f"LLM API call failed: {e}")
            raise ValueError(f"Failed to get LLM response: {e}")

        # Parse response
        try:
            evaluation_data = self._parse_llm_response(response_text)
        except ValueError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            raise

        # Calculate weighted total score
        calculated_total = (
            evaluation_data["academic_score"] * self.settings.weight_academic +
            evaluation_data["test_score"] * self.settings.weight_test +
            evaluation_data["achievement_score"] * self.settings.weight_achievement +
            evaluation_data["essay_score"] * self.settings.weight_essay
        )

        # Allow some flexibility (within 5 points)
        if abs(evaluation_data["total_score"] - calculated_total) > 5:
            logger.warning(
                f"Total score mismatch: LLM provided {evaluation_data['total_score']}, "
                f"calculated {calculated_total:.2f}. Using calculated value."
            )
            evaluation_data["total_score"] = round(calculated_total, 2)

        # Create WorkerResult
        worker_result = WorkerResult(
            anonymized_id=application.anonymized_id,
            attempt_number=attempt_number,
            academic_score=evaluation_data["academic_score"],
            test_score=evaluation_data["test_score"],
            achievement_score=evaluation_data["achievement_score"],
            essay_score=evaluation_data["essay_score"],
            total_score=evaluation_data["total_score"],
            explanation=evaluation_data["explanation"],
            reasoning=evaluation_data["reasoning"],
            rubric_adherence=evaluation_data["rubric_adherence"],
            timestamp=datetime.utcnow(),
            model_used=self.settings.worker_model
        )

        # Persist result
        self.csv_handler.append_worker_result(worker_result)

        # Audit log
        if self.audit_logger:
            self.audit_logger.log_worker_evaluation(
                anonymized_id=application.anonymized_id,
                worker_result_id=worker_result.result_id,
                attempt_number=attempt_number,
                total_score=worker_result.total_score
            )

        logger.info(
            f"Worker evaluation complete: {application.anonymized_id} "
            f"→ {worker_result.total_score:.2f}/100 (attempt {attempt_number})"
        )

        return worker_result
