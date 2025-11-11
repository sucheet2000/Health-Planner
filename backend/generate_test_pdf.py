from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

def create_sample_patient_pdf(filename):
    """
    Create a sample patient clinical records PDF for testing
    """
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1*inch, height - 1*inch, "PATIENT CLINICAL RECORDS")

    # Patient Demographics
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, height - 1.5*inch, "Patient Demographics:")

    c.setFont("Helvetica", 10)
    y_position = height - 1.8*inch
    records = [
        "Name: John Doe",
        "DOB: 01/15/1965",
        "MRN: 123456",
        "Gender: Male",
        "Phone: (555) 123-4567",
        "",
        "Primary Diagnosis: G70.0 - Myasthenia Gravis",
        "",
        "Chief Complaint:",
        "Patient presents with progressive muscle weakness, ptosis, and diplopia.",
        "Symptoms worsen with activity and improve with rest.",
        "",
        "History of Present Illness:",
        "58-year-old male with a 2-year history of myasthenia gravis.",
        "Currently on pyridostigmine 60mg q6h with partial symptom control.",
        "Recent increase in bulbar symptoms prompting consideration for IVIG therapy.",
        "",
        "Past Medical History:",
        "- Myasthenia Gravis (diagnosed 2021)",
        "- Hypertension",
        "- Type 2 Diabetes Mellitus",
        "",
        "Current Medications:",
        "- Pyridostigmine 60mg PO q6h",
        "- Prednisone 10mg PO daily",
        "- Lisinopril 10mg PO daily",
        "- Metformin 1000mg PO BID",
        "",
        "Laboratory Results:",
        "- AChR Antibodies: Positive (15.2 nmol/L)",
        "- CK: 145 U/L (normal)",
        "- TSH: 2.1 mIU/L (normal)",
        "- HgbA1c: 6.8%",
        "",
        "Physical Examination:",
        "- BP: 138/82 mmHg",
        "- HR: 72 bpm",
        "- Neurological: Bilateral ptosis, fatigable weakness in proximal muscles",
        "- Ice pack test: Positive",
        "",
        "Assessment and Plan:",
        "Patient is a candidate for IVIG therapy given inadequate response to",
        "oral immunosuppression. Plan to initiate Privigen 2g/kg over 2-5 days.",
        "Will monitor for adverse reactions and assess response after treatment.",
        "",
        "Referring Provider: Dr. Sarah Smith, MD",
        "Provider NPI: 1234567890",
        "Date of Visit: " + "2024-10-20"
    ]

    for line in records:
        c.drawString(1*inch, y_position, line)
        y_position -= 0.2*inch

        # Create new page if needed
        if y_position < 1*inch:
            c.showPage()
            c.setFont("Helvetica", 10)
            y_position = height - 1*inch

    c.save()
    print(f"Created sample PDF: {filename}")

if __name__ == "__main__":
    create_sample_patient_pdf("../frontend/src/test/fixtures/sample-patient-record.pdf")
