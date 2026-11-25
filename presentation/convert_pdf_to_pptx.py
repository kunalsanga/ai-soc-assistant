"""Convert the compiled 19-slide Beamer presentation (main.pdf) into high-resolution PPTX."""
import io
import shutil
from pathlib import Path
import fitz  # pymupdf
from pptx import Presentation
from pptx.util import Inches

def main():
    pdf_path = Path("presentation/Seminar_Presentation_1_/main.pdf")
    if not pdf_path.exists():
        raise FileNotFoundError(f"Missing {pdf_path}")
        
    doc = fitz.open(str(pdf_path))
    print(f"Loaded PDF: {pdf_path} ({len(doc)} pages)")
    
    # 16:9 widescreen dimensions: 13.333 x 7.5 inches
    prs = Presentation()
    prs.slide_width = Inches(13.333333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]  # completely blank slide
    
    for i, page in enumerate(doc):
        # Render high-resolution pixmap (300 DPI: zoom factor 300 / 72 ≈ 4.1667)
        zoom = 300 / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        
        slide = prs.slides.add_slide(blank_layout)
        slide.shapes.add_picture(
            io.BytesIO(img_bytes),
            left=0,
            top=0,
            width=prs.slide_width,
            height=prs.slide_height
        )
        print(f"Rendered slide {i+1}/{len(doc)}")
        
    out_pptx1 = Path("presentation/PPD2_Third_Review_Presentation.pptx")
    out_pptx2 = Path("presentation/Seminar_Presentation_1_/PPD2_Third_Review_Presentation.pptx")
    prs.save(str(out_pptx1))
    prs.save(str(out_pptx2))
    print(f"Saved PPTX to {out_pptx1} and {out_pptx2}")
    
    # Copy PDF to root presentation directory
    out_pdf1 = Path("presentation/PPD2_Third_Review_Presentation.pdf")
    out_pdf2 = Path("presentation/main.pdf")
    shutil.copy2(pdf_path, out_pdf1)
    shutil.copy2(pdf_path, out_pdf2)
    print(f"Copied PDF to {out_pdf1} and {out_pdf2}")

if __name__ == "__main__":
    main()

