import json
import asyncio
from app.core.config import settings

class ReportEngine:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL

    async def generate_report(self, acuity_results: list, summary_stats: dict) -> dict:
        """
        Uses LangChain + Ollama to synthesize acuity results and gaze behavior 
        into a structured, clinical-style JSON report.
        """
        prompt_text = """
You are an expert clinical ophthalmologist. Analyze the following visual acuity results and webcam behavioral monitoring metrics to generate a professional eye health screening report.

### Visual Acuity Scores:
{acuity_results}

### Webcam Behavioral Analysis:
{summary_stats}

Generate the response in strict JSON format matching the schema below. Do not include any markdown format tags or conversational text. Return ONLY the raw JSON string:
{{
  "clinical_assessment": "Clear professional summary of the visual acuity (stating if normal or reduced) and behavioral observations (blinks, fixations, eye fatigue, squinting).",
  "risk_flags": {{
    "low_acuity_detected": true/false,
    "high_blink_rate": true/false,
    "poor_fixation_stability": true/false,
    "excessive_squinting": true/false
  }},
  "recommendations": "Actionable advice (consult optometrist, repeat under better light, optimize screen distances, etc.)"
}}
"""
        # Heuristics fallback in case Ollama is offline or local dependencies fail
        fallback_report = {
            "clinical_assessment": f"Visual acuity screening completed. Acuity: Left Eye: {self._get_score(acuity_results, 'LEFT')}, Right Eye: {self._get_score(acuity_results, 'RIGHT')}, Both Eyes: {self._get_score(acuity_results, 'BOTH')}. Behavior analysis recorded an average EAR of {summary_stats.get('average_ear', 0.0):.3f} and {summary_stats.get('total_blinks', 0)} blinks.",
            "risk_flags": {
                "low_acuity_detected": self._check_low_acuity(acuity_results),
                "high_blink_rate": summary_stats.get("blink_frequency_per_min", 0) > 25,
                "poor_fixation_stability": summary_stats.get("fixation_ratio", 1.0) < 0.60,
                "excessive_squinting": summary_stats.get("average_ear", 0.3) < 0.23
            },
            "recommendations": " Retest under optimal lighting conditions. If acuity is below 6/6 in either eye, a comprehensive eye exam with an optometrist is recommended."
        }

        # Quick TCP check to prevent hangs when Ollama port is not open
        if not self._is_ollama_online():
            print("[ReportEngine] Ollama port is unreachable. Using heuristics engine.")
            return fallback_report

        try:
            from langchain_community.llms import Ollama
            from langchain.prompts import PromptTemplate

            llm = Ollama(base_url=self.base_url, model=self.model, temperature=0.2)
            prompt = PromptTemplate(
                template=prompt_text,
                input_variables=["acuity_results", "summary_stats"]
            )
            
            chain = prompt | llm

            formatted_acuity = json.dumps(acuity_results, indent=2)
            formatted_summary = json.dumps(summary_stats, indent=2)

            loop = asyncio.get_event_loop()
            raw_response = await loop.run_in_executor(
                None,
                lambda: chain.invoke({"acuity_results": formatted_acuity, "summary_stats": formatted_summary})
            )

            text = raw_response.strip()
            # Clean up response to get JSON block if LLM returned markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()

            return json.loads(text)

        except Exception as e:
            print(f"[ReportEngine] LangChain/Ollama call failed: {e}. Using heuristics engine.")
            return fallback_report

    def _is_ollama_online(self) -> bool:
        import socket
        from urllib.parse import urlparse
        try:
            parsed = urlparse(self.base_url)
            host = parsed.hostname or "localhost"
            port = parsed.port or 11434
            with socket.create_connection((host, port), timeout=0.8):
                return True
        except Exception:
            return False

    def _get_score(self, results, eye):
        for r in results:
            if r.get("eye_tested") == eye:
                return r.get("acuity_score")
        return "Not Tested"

    def _check_low_acuity(self, results):
        for r in results:
            score = r.get("acuity_score", "6/6")
            if score not in ["6/6", "6/9", "Not Tested"]:
                return True
        return False

report_engine = ReportEngine()
