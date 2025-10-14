import hashlib
import secrets
import base64

def generate_pkce_pair():
    """Generates a PKCE code_verifier and code_challenge."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode('utf-8')
    return code_verifier, code_challenge

if __name__ == "__main__":
    verifier, challenge = generate_pkce_pair()
    print("--- PKCE Key Pair ---")
    print(f"Code Verifier:  {verifier}")
    print(f"Code Challenge: {challenge}")
    print("---------------------")
