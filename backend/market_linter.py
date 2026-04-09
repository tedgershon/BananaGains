import re


def lint_market_fields(body):
    """Apply style conformity rules to market text fields."""
    return body.model_copy(update={
        "title": _lint_title(body.title),
        "description": _lint_body_text(body.description),
        "resolution_criteria": _lint_body_text(body.resolution_criteria),
        "yes_criteria": _lint_body_text(body.yes_criteria),
        "no_criteria": _lint_body_text(body.no_criteria),
        "ambiguity_criteria": _lint_body_text(body.ambiguity_criteria),
        "official_source": body.official_source.strip(),
    })


def _lint_title(text: str) -> str:
    """Lint a market title: remove extra whitespace, capitalize appropriately."""
    text = re.sub(r"\s+", " ", text.strip())
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    return text


def _lint_body_text(text: str) -> str:
    """Lint body text: remove redundant whitespace, ensure sentence capitalization and punctuation."""
    text = re.sub(r"\s+", " ", text.strip())
    sentences = re.split(r"(?<=[.!?])\s+", text)
    linted_sentences = []
    for s in sentences:
        s = s.strip()
        if s and s[0].islower():
            s = s[0].upper() + s[1:]
        linted_sentences.append(s)
    text = " ".join(linted_sentences)
    if text and text[-1] not in ".!?":
        text += "."
    return text
