import json


def parse_json_response(response, context):
    choice = response.choices[0]
    finish_reason = getattr(choice, "finish_reason", None)
    content = (choice.message.content or "").strip()

    if finish_reason == "length":
        raise ValueError(
            f"{context}: Die OpenAI-Antwort wurde abgeschnitten. "
            "Bitte erneut versuchen oder das Ausgabelimit erhoehen."
        )

    if not content:
        raise ValueError(f"{context}: Die OpenAI-Antwort war leer.")

    if content.startswith("```"):
        content = content.split("```", 2)[1]
        if content.startswith("json"):
            content = content[4:]
    if content.endswith("```"):
        content = content[:-3]

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        preview = content[:300].replace("\n", " ")
        raise ValueError(
            f"{context}: Die OpenAI-Antwort war kein gueltiges JSON "
            f"(Zeile {exc.lineno}, Spalte {exc.colno}: {exc.msg}). "
            f"Antwortbeginn: {preview}"
        ) from exc
