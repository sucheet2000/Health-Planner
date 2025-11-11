from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Health Planner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
if not anthropic_api_key:
    raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

client = anthropic.Anthropic(api_key=anthropic_api_key)


class FormData(BaseModel):
    patientFirstName: str
    patientLastName: str
    patientMRN: str
    primaryDiagnosis: str
    referringProvider: str
    providerNPI: str
    medicationName: str
    additionalDiagnoses: List[str] = []
    medicationHistory: List[str] = []
    patientRecords: str


class CarePlanRequest(BaseModel):
    formData: FormData


class CarePlanResponse(BaseModel):
    carePlan: str


class PharmacistFeedbackItem(BaseModel):
    pharmacistName: str
    feedbackType: str  # 'correction', 'suggestion', 'approval'
    sectionName: str  # e.g., "PROBLEM LIST", "PHARMACIST INTERVENTIONS"
    originalText: Optional[str] = None
    correctedText: Optional[str] = None
    comment: Optional[str] = None
    approved: bool = False


class PharmacistFeedbackRequest(BaseModel):
    orderId: str
    feedback: List[PharmacistFeedbackItem]
    finalCarePlan: Optional[str] = None  # If pharmacist manually edited the care plan


class PharmacistFeedbackResponse(BaseModel):
    success: bool
    message: str
    updatedCarePlan: str


@app.get("/")
async def root():
    return {"message": "Health Planner API is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/generate-careplan", response_model=CarePlanResponse)
async def generate_care_plan(request: CarePlanRequest):
    """
    Generate a care plan using Claude AI based on patient information and clinical records.
    """
    try:
        form_data = request.formData

        prompt = f"""You are a clinical pharmacist specializing in specialty pharmacy care planning.
Based on the patient information and clinical records provided below, generate a comprehensive pharmacist care plan following the standardized format used in specialty pharmacy practice.

PATIENT INFORMATION:
- Name: {form_data.patientFirstName} {form_data.patientLastName}
- MRN: {form_data.patientMRN}
- Primary Diagnosis (ICD-10): {form_data.primaryDiagnosis}
- Additional Diagnoses: {', '.join(form_data.additionalDiagnoses) if form_data.additionalDiagnoses else 'None'}

PROVIDER INFORMATION:
- Referring Provider: {form_data.referringProvider}
- Provider NPI: {form_data.providerNPI}

MEDICATION INFORMATION:
- Prescribed Medication: {form_data.medicationName}
- Medication History: {', '.join(form_data.medicationHistory) if form_data.medicationHistory else 'None documented'}

PATIENT CLINICAL RECORDS:
{form_data.patientRecords}

Please generate a comprehensive pharmacist care plan using the following structure:

PROBLEM LIST / DRUG THERAPY PROBLEMS (DTPs)
List all relevant drug therapy problems including:
- Need for therapy / efficacy concerns
- Risk of adverse reactions (infusion-related, allergic, etc.)
- Risk of organ dysfunction (renal, hepatic, etc.)
- Risk of thromboembolic events or other serious complications
- Potential drug-drug interactions or dosing timing issues
- Patient education / adherence gaps

GOALS (SMART)
Define specific, measurable goals including:
- Primary therapeutic goal (efficacy)
- Safety goals (specific parameters to avoid complications)
- Process goals (completion of therapy with monitoring)

PHARMACIST INTERVENTIONS / PLAN
Provide detailed interventions for:

1. Dosing & Administration
   - Verify dose calculation and total course
   - Document lot number and expiration tracking requirements

2. Premedication
   - Recommend specific premeds with doses and timing
   - Rationale for premedication strategy

3. Infusion Rates & Titration
   - Starting rate and escalation schedule
   - How to manage infusion reactions

4. Hydration & Organ Protection (if applicable)
   - Renal protection strategies
   - Fluid management recommendations
   - Product selection considerations

5. Risk Mitigation (thrombosis, infections, etc.)
   - Risk assessment
   - Prophylactic measures if needed
   - Patient education on warning signs

6. Concomitant Medications
   - Continue/modify existing medications
   - Timing considerations
   - Drug interaction monitoring

7. Monitoring During Administration
   - Vital sign monitoring schedule
   - Lab monitoring (if applicable)
   - Documentation requirements

8. Adverse Event Management
   - Mild reaction management
   - Moderate/severe reaction protocols
   - Emergency contact information

9. Documentation & Communication
   - EMR documentation requirements
   - Communication plan with team

MONITORING PLAN & LAB SCHEDULE
Provide specific schedule:
- Before therapy: Required baseline labs and assessments
- During therapy: Monitoring frequency and parameters
- Post-therapy: Follow-up labs and timeframes
- Clinical follow-up: Schedule for efficacy and safety assessment

Please format the care plan in a clear, professional manner suitable for clinical documentation and EMR entry. Use bullet points and clear sections. Be specific with doses, frequencies, and timeframes where applicable."""

        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=4096,
            temperature=0.7,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        care_plan = message.content[0].text

        return CarePlanResponse(carePlan=care_plan)

    except anthropic.AuthenticationError as e:
        print(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication error. Please check the API key configuration."
        )
    except anthropic.APIError as e:
        print(f"Claude API error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Claude API error: {str(e)}"
        )
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error generating care plan: {str(e)}"
        )


@app.post("/api/submit-pharmacist-feedback", response_model=PharmacistFeedbackResponse)
async def submit_pharmacist_feedback(request: PharmacistFeedbackRequest):
    """
    Accept pharmacist feedback on generated care plans.
    Tracks all corrections and approval status.
    """
    try:
        order_id = request.orderId
        feedback_items = request.feedback
        final_care_plan = request.finalCarePlan

        correction_history = []
        all_approved = True

        for feedback in feedback_items:
            correction_entry = {
                "pharmacistName": feedback.pharmacistName,
                "feedbackType": feedback.feedbackType,
                "sectionName": feedback.sectionName,
                "comment": feedback.comment or "",
                "approved": feedback.approved
            }

            if feedback.correctedText and feedback.originalText:
                correction_entry["before"] = feedback.originalText
                correction_entry["after"] = feedback.correctedText
                correction_entry["change"] = f"Updated {feedback.sectionName}: {feedback.comment or 'Manual correction'}"
            else:
                correction_entry["change"] = feedback.comment or f"{feedback.feedbackType} on {feedback.sectionName}"

            correction_history.append(correction_entry)

            if not feedback.approved:
                all_approved = False

        approval_status = "approved" if all_approved else "corrections_pending"
        updated_care_plan = final_care_plan or f"Care Plan with Pharmacist Review - {len(feedback_items)} feedback items processed"

        return PharmacistFeedbackResponse(
            success=True,
            message=f"Pharmacist feedback submitted successfully. Status: {approval_status}",
            updatedCarePlan=updated_care_plan
        )

    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error processing pharmacist feedback: {str(e)}"
        )


@app.post("/api/regenerate-careplan-with-feedback", response_model=CarePlanResponse)
async def regenerate_careplan_with_feedback(request: PharmacistFeedbackRequest):
    """
    Regenerate care plan based on pharmacist feedback and corrections.
    Uses Claude AI to incorporate feedback into a revised care plan.
    """
    try:
        corrections = []
        suggestions = []
        approved_sections = []

        for feedback in request.feedback:
            if feedback.feedbackType == 'correction':
                if feedback.originalText and feedback.correctedText:
                    corrections.append(
                        f"SECTION: {feedback.sectionName}\n"
                        f"Original: {feedback.originalText}\n"
                        f"Corrected: {feedback.correctedText}\n"
                        f"Rationale: {feedback.comment or 'See correction above'}"
                    )
            elif feedback.feedbackType == 'suggestion':
                suggestions.append(
                    f"SECTION: {feedback.sectionName}\n"
                    f"Suggestion: {feedback.comment}"
                )
            elif feedback.feedbackType == 'approval':
                approved_sections.append(feedback.sectionName)

        feedback_prompt = f"""You are a clinical pharmacist reviewing and improving a care plan based on professional feedback.

PHARMACIST FEEDBACK RECEIVED:

CORRECTIONS NEEDED:
{chr(10).join(corrections) if corrections else "None"}

SUGGESTIONS FOR IMPROVEMENT:
{chr(10).join(suggestions) if suggestions else "None"}

SECTIONS APPROVED AS-IS:
{', '.join(approved_sections) if approved_sections else "None yet"}

Please revise the care plan below to:
1. Incorporate all corrections exactly as specified
2. Address all suggestions in the appropriate sections
3. Keep approved sections unchanged
4. Maintain the professional structure and all required sections
5. Ensure clinical accuracy and safety

Return the COMPLETE revised care plan with all sections, not just the changed parts."""

        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=4096,
            temperature=0.7,
            messages=[
                {
                    "role": "user",
                    "content": feedback_prompt
                }
            ]
        )

        improved_care_plan = message.content[0].text

        return CarePlanResponse(carePlan=improved_care_plan)

    except anthropic.AuthenticationError as e:
        print(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication error. Please check the API key configuration."
        )
    except anthropic.APIError as e:
        print(f"Claude API error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Claude API error: {str(e)}"
        )
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error regenerating care plan: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
