from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "output" / "pdf" / "drake-ai-separate-deployment-guide.pdf"
PREVIEW_DIR = ROOT / "output" / "pdf" / "preview"


def main():
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    with fitz.open(PDF_PATH) as doc:
        for page_index, page in enumerate(doc):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False)
            pix.save(PREVIEW_DIR / f"deployment-guide-page-{page_index + 1}.png")
        print(f"pages={len(doc)}")


if __name__ == "__main__":
    main()
