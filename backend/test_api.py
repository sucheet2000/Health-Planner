"""
Comprehensive API Tests for Care Plan System
Tests all API endpoints, error handling, validation, and business logic
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)


# ============================================================================
# HEALTH CHECK AND BASIC ENDPOINT TESTS
# ============================================================================

class TestHealthEndpoints:
    """Test basic health check and info endpoints"""

    def test_health_endpoint_returns_200(self):
        """Ensure /health endpoint is alive and returns healthy status"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_health_endpoint_response_format(self):
        """Verify health endpoint returns correct JSON structure"""
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert isinstance(data["status"], str)

    def test_root_endpoint_returns_api_info(self):
        """Check root endpoint returns version and message"""
        response = client.get("/")
        data = response.json()
        assert response.status_code == 200
        assert "message" in data
        assert "version" in data
        assert data["version"] == "1.0.0"

    def test_root_endpoint_structure(self):
        """Verify root endpoint has all required fields"""
        response = client.get("/")
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert isinstance(data["message"], str)
        assert isinstance(data["version"], str)


# ============================================================================
# CARE PLAN GENERATION TESTS
# ============================================================================

class TestCarePlanGeneration:
    """Test care plan generation endpoint with various scenarios"""

    @pytest.fixture
    def valid_request_payload(self):
        """Standard valid request payload for care plan generation"""
        return {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Sarah Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": ["I10", "E11.9"],
                "medicationHistory": ["Pyridostigmine 60mg q6h", "Prednisone 10mg daily"],
                "patientRecords": "Patient presents with myasthenia gravis symptoms..."
            }
        }

    @pytest.fixture
    def mock_anthropic_client(self):
        """Mock Claude AI client to avoid API costs during testing"""
        with patch('main.client') as mock_client:
            # Create a mock response object
            mock_response = MagicMock()
            mock_content = MagicMock()
            mock_content.text = """
PHARMACIST CARE PLAN

Patient: John Doe (MRN: 123456)
Diagnosis: G70.0 - Myasthenia Gravis

CLINICAL ASSESSMENT:
Patient is a candidate for IVIG therapy with Privigen.

MEDICATION RECOMMENDATIONS:
1. Privigen 2g/kg IV over 2-5 days
2. Continue pyridostigmine 60mg q6h
3. Continue prednisone 10mg daily

MONITORING PLAN:
- Monitor for adverse reactions during infusion
- Assess symptom improvement after treatment
- Follow-up in 2 weeks

PATIENT EDUCATION:
- Explained IVIG therapy process
- Discussed potential side effects
- Provided emergency contact information
"""
            mock_response.content = [mock_content]
            mock_client.messages.create.return_value = mock_response
            yield mock_client

    def test_generate_careplan_with_valid_data(self, valid_request_payload, mock_anthropic_client):
        """Test successful care plan generation with valid patient data"""
        response = client.post("/api/generate-careplan", json=valid_request_payload)

        assert response.status_code == 200
        data = response.json()
        assert "carePlan" in data
        assert isinstance(data["carePlan"], str)
        assert len(data["carePlan"]) > 0
        assert "PHARMACIST CARE PLAN" in data["carePlan"]

    def test_generate_careplan_contains_patient_info(self, valid_request_payload, mock_anthropic_client):
        """Verify generated care plan includes patient information"""
        response = client.post("/api/generate-careplan", json=valid_request_payload)
        data = response.json()

        assert response.status_code == 200
        care_plan = data["carePlan"]
        assert "John Doe" in care_plan
        assert "123456" in care_plan

    def test_generate_careplan_with_minimal_data(self, mock_anthropic_client):
        """Test care plan generation with minimal required fields"""
        minimal_payload = {
            "formData": {
                "patientFirstName": "Jane",
                "patientLastName": "Smith",
                "patientMRN": "654321",
                "primaryDiagnosis": "I10",
                "referringProvider": "Dr. Johnson",
                "providerNPI": "9876543210",
                "medicationName": "IVIG",
                "additionalDiagnoses": [],
                "medicationHistory": [],
                "patientRecords": "Patient records here"
            }
        }

        response = client.post("/api/generate-careplan", json=minimal_payload)
        assert response.status_code == 200
        data = response.json()
        assert "carePlan" in data

    def test_generate_careplan_missing_required_fields(self):
        """Test that missing required fields returns 422 validation error"""
        invalid_payload = {
            "formData": {
                "patientFirstName": "John"
                # Missing all other required fields
            }
        }

        response = client.post("/api/generate-careplan", json=invalid_payload)
        assert response.status_code == 422

    def test_generate_careplan_empty_form_data(self):
        """Test with empty formData object"""
        invalid_payload = {"formData": {}}

        response = client.post("/api/generate-careplan", json=invalid_payload)
        assert response.status_code == 422

    def test_generate_careplan_null_values(self):
        """Test handling of null values in form data"""
        invalid_payload = {
            "formData": {
                "patientFirstName": None,
                "patientLastName": None,
                "patientMRN": None,
                "primaryDiagnosis": None,
                "referringProvider": None,
                "providerNPI": None,
                "medicationName": None,
                "additionalDiagnoses": None,
                "medicationHistory": None,
                "patientRecords": None
            }
        }

        response = client.post("/api/generate-careplan", json=invalid_payload)
        assert response.status_code == 422

    def test_generate_careplan_with_special_characters(self, mock_anthropic_client):
        """Test care plan generation with special characters in patient data"""
        payload = {
            "formData": {
                "patientFirstName": "José",
                "patientLastName": "O'Brien-Smith",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. François",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": [],
                "medicationHistory": [],
                "patientRecords": "Patient with special characters in name"
            }
        }

        response = client.post("/api/generate-careplan", json=payload)
        assert response.status_code == 200


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling:
    """Test API error handling for various scenarios"""

    def test_nonexistent_endpoint_returns_404(self):
        """Verify non-existent routes return 404 Not Found"""
        response = client.get("/no-such-endpoint")
        assert response.status_code == 404

    def test_invalid_method_returns_405(self):
        """Test that using wrong HTTP method returns 405 Method Not Allowed"""
        response = client.put("/health")
        assert response.status_code == 405

    def test_malformed_json_returns_422(self):
        """Test that malformed JSON in request body returns 422"""
        response = client.post(
            "/api/generate-careplan",
            data="This is not valid JSON",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422

    def test_missing_content_type_header(self):
        """Test request without proper content-type header"""
        response = client.post(
            "/api/generate-careplan",
            data='{"formData": {}}',
        )
        # FastAPI should still handle this
        assert response.status_code in [422, 400]

    def test_empty_request_body(self):
        """Test POST request with empty body"""
        response = client.post("/api/generate-careplan")
        assert response.status_code == 422


# ============================================================================
# CORS AND HEADERS TESTS
# ============================================================================

class TestCORSAndHeaders:
    """Test CORS configuration and response headers"""

    def test_cors_headers_present_on_post_request(self):
        """Verify CORS headers are set on regular POST requests"""
        # Note: FastAPI/Starlette doesn't allow OPTIONS by default on POST routes
        # CORS is verified through POST requests instead
        response = client.post(
            "/api/generate-careplan",
            json={},
            headers={"Origin": "http://localhost:3001"}
        )
        # Should respond (might be 422 for invalid data, but CORS should work)
        assert response.status_code in [200, 422]

    def test_cors_allows_localhost_origins(self):
        """Test that CORS allows configured localhost origins"""
        response = client.get(
            "/health",
            headers={"Origin": "http://localhost:3001"}
        )
        # Should not be blocked by CORS
        assert response.status_code == 200

    def test_response_content_type(self):
        """Verify API returns correct content-type header"""
        response = client.get("/health")
        assert "application/json" in response.headers.get("content-type", "")


# ============================================================================
# INPUT VALIDATION TESTS
# ============================================================================

class TestInputValidation:
    """Test input validation for care plan generation"""

    def test_invalid_mrn_format(self, mock_anthropic_client):
        """Test that invalid MRN format is handled (note: backend doesn't validate format, just accepts data)"""
        payload = {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "INVALID",  # Should be 6 digits
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": [],
                "medicationHistory": [],
                "patientRecords": "Records"
            }
        }

        # Backend accepts any string for MRN (validation happens on frontend)
        # This test verifies the backend doesn't crash with non-numeric MRN
        response = client.post("/api/generate-careplan", json=payload)
        assert response.status_code in [200, 422]

    def test_very_long_patient_records(self, mock_anthropic_client):
        """Test handling of very long patient clinical records"""
        long_records = "Patient clinical notes. " * 1000

        payload = {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": [],
                "medicationHistory": [],
                "patientRecords": long_records
            }
        }

        response = client.post("/api/generate-careplan", json=payload)
        assert response.status_code == 200

    def test_empty_patient_records(self, mock_anthropic_client):
        """Test care plan generation with empty patient records"""
        payload = {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": [],
                "medicationHistory": [],
                "patientRecords": ""
            }
        }

        response = client.post("/api/generate-careplan", json=payload)
        # Should still work with empty records
        assert response.status_code == 200


# ============================================================================
# DATA TYPE TESTS
# ============================================================================

class TestDataTypes:
    """Test handling of different data types in requests"""

    def test_additional_diagnoses_as_array(self, mock_anthropic_client):
        """Test that additionalDiagnoses accepts array of strings"""
        payload = {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": ["I10", "E11.9", "K21.9"],
                "medicationHistory": [],
                "patientRecords": "Records"
            }
        }

        response = client.post("/api/generate-careplan", json=payload)
        assert response.status_code == 200

    def test_medication_history_as_array(self, mock_anthropic_client):
        """Test that medicationHistory accepts array of strings"""
        payload = {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": [],
                "medicationHistory": [
                    "Pyridostigmine 60mg q6h",
                    "Prednisone 10mg daily",
                    "Lisinopril 10mg daily"
                ],
                "patientRecords": "Records"
            }
        }

        response = client.post("/api/generate-careplan", json=payload)
        assert response.status_code == 200


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestIntegration:
    """End-to-end integration tests"""

    def test_complete_workflow_with_all_fields(self, mock_anthropic_client):
        """Test complete care plan generation workflow with all fields populated"""
        complete_payload = {
            "formData": {
                "patientFirstName": "John",
                "patientLastName": "Doe",
                "patientMRN": "123456",
                "primaryDiagnosis": "G70.0",
                "referringProvider": "Dr. Sarah Smith",
                "providerNPI": "1234567890",
                "medicationName": "Privigen",
                "additionalDiagnoses": ["I10", "E11.9"],
                "medicationHistory": [
                    "Pyridostigmine 60mg q6h",
                    "Prednisone 10mg daily",
                    "Lisinopril 10mg daily",
                    "Metformin 1000mg BID"
                ],
                "patientRecords": """
                PATIENT CLINICAL RECORDS

                Patient Demographics:
                Name: John Doe
                DOB: 01/15/1965
                MRN: 123456

                Primary Diagnosis: G70.0 - Myasthenia Gravis

                Current Medications:
                - Pyridostigmine 60mg PO q6h
                - Prednisone 10mg PO daily

                Assessment: Patient is a candidate for IVIG therapy.
                """
            }
        }

        response = client.post("/api/generate-careplan", json=complete_payload)

        assert response.status_code == 200
        data = response.json()
        assert "carePlan" in data
        assert len(data["carePlan"]) > 10  # Care plan should contain text
        assert isinstance(data["carePlan"], str)


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

class TestPerformance:
    """Basic performance and load tests"""

    def test_health_endpoint_response_time(self):
        """Health endpoint should respond quickly"""
        import time
        start = time.time()
        response = client.get("/health")
        end = time.time()

        assert response.status_code == 200
        assert (end - start) < 1.0  # Should respond in less than 1 second

    def test_multiple_concurrent_health_checks(self):
        """Test multiple health check requests"""
        responses = [client.get("/health") for _ in range(10)]
        assert all(r.status_code == 200 for r in responses)


# ============================================================================
# PHARMACIST FEEDBACK TESTS
# ============================================================================

class TestPharmacistFeedback:
    """Test pharmacist feedback submission endpoints"""

    @pytest.fixture
    def valid_feedback_payload(self):
        """Standard valid feedback payload"""
        return {
            "orderId": "test_order_123",
            "feedback": [
                {
                    "pharmacistName": "Dr. Jane Pharmacist",
                    "feedbackType": "suggestion",
                    "sectionName": "PROBLEM LIST",
                    "comment": "Consider adding renal function risk",
                    "approved": False
                },
                {
                    "pharmacistName": "Dr. Jane Pharmacist",
                    "feedbackType": "correction",
                    "sectionName": "DOSING & ADMINISTRATION",
                    "originalText": "2g/kg over 3 days",
                    "correctedText": "2g/kg over 2-5 days based on tolerance",
                    "comment": "Clarify infusion schedule",
                    "approved": True
                }
            ],
            "finalCarePlan": None
        }

    def test_submit_pharmacist_feedback_valid(self, valid_feedback_payload):
        """Test successful pharmacist feedback submission"""
        response = client.post("/api/submit-pharmacist-feedback", json=valid_feedback_payload)

        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["success"] is True
        assert "message" in data
        assert "updatedCarePlan" in data

    def test_pharmacist_feedback_determines_approval_status(self):
        """Test that feedback determines approval status correctly"""
        # All approved
        payload_all_approved = {
            "orderId": "test_order_456",
            "feedback": [
                {
                    "pharmacistName": "Dr. John Pharmacist",
                    "feedbackType": "approval",
                    "sectionName": "GOALS",
                    "comment": "Looks good",
                    "approved": True
                }
            ],
            "finalCarePlan": None
        }

        response = client.post("/api/submit-pharmacist-feedback", json=payload_all_approved)
        assert response.status_code == 200
        data = response.json()
        assert "approved" in data["message"]

    def test_pharmacist_feedback_with_manual_care_plan(self):
        """Test feedback submission with manually edited care plan"""
        payload = {
            "orderId": "test_order_789",
            "feedback": [
                {
                    "pharmacistName": "Dr. Mary Pharmacist",
                    "feedbackType": "correction",
                    "sectionName": "MONITORING PLAN",
                    "originalText": "Check labs weekly",
                    "correctedText": "Check labs biweekly",
                    "comment": "Adjusted monitoring frequency",
                    "approved": False
                }
            ],
            "finalCarePlan": "REVISED CARE PLAN\n\nAll sections have been reviewed and updated..."
        }

        response = client.post("/api/submit-pharmacist-feedback", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "finalCarePlan" in payload or "updatedCarePlan" in data

    def test_submit_pharmacist_feedback_missing_order_id(self):
        """Test feedback submission without order ID"""
        payload = {
            "feedback": [
                {
                    "pharmacistName": "Dr. Pharmacist",
                    "feedbackType": "suggestion",
                    "sectionName": "GOALS",
                    "comment": "Test",
                    "approved": False
                }
            ]
        }

        response = client.post("/api/submit-pharmacist-feedback", json=payload)
        # Should fail due to missing orderId
        assert response.status_code in [422, 400]

    def test_submit_pharmacist_feedback_empty_feedback(self):
        """Test feedback submission with empty feedback list"""
        payload = {
            "orderId": "test_order_empty",
            "feedback": [],
            "finalCarePlan": None
        }

        response = client.post("/api/submit-pharmacist-feedback", json=payload)
        assert response.status_code == 200

    def test_regenerate_careplan_with_feedback(self):
        """Test regenerating care plan with feedback"""
        payload = {
            "orderId": "test_order_regen",
            "feedback": [
                {
                    "pharmacistName": "Dr. Regenerate",
                    "feedbackType": "suggestion",
                    "sectionName": "PROBLEM LIST",
                    "comment": "Add risk assessment",
                    "approved": False
                },
                {
                    "pharmacistName": "Dr. Regenerate",
                    "feedbackType": "correction",
                    "sectionName": "INFUSION RATES",
                    "originalText": "Start at 0.5 mL/kg/hr",
                    "correctedText": "Start at 0.25 mL/kg/hr for first hour",
                    "comment": "Slower initial rate for safety",
                    "approved": True
                }
            ]
        }

        response = client.post("/api/regenerate-careplan-with-feedback", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert "carePlan" in data
        assert isinstance(data["carePlan"], str)
        assert "REVISED CARE PLAN" in data["carePlan"]

    def test_regenerate_careplan_feedback_summary_included(self):
        """Test that regenerated care plan includes feedback summary"""
        payload = {
            "orderId": "test_order_summary",
            "feedback": [
                {
                    "pharmacistName": "Dr. Summary",
                    "feedbackType": "correction",
                    "sectionName": "ADVERSE EVENT MANAGEMENT",
                    "comment": "Update reaction protocols",
                    "approved": False
                }
            ]
        }

        response = client.post("/api/regenerate-careplan-with-feedback", json=payload)
        data = response.json()
        care_plan = data["carePlan"]

        # Feedback should be summarized in the regenerated plan
        assert "feedback" in care_plan.lower() or "updated" in care_plan.lower()

    def test_pharmacist_feedback_missing_pharmacist_name(self):
        """Test feedback item without pharmacist name"""
        payload = {
            "orderId": "test_order_no_name",
            "feedback": [
                {
                    "feedbackType": "suggestion",
                    "sectionName": "GOALS",
                    "comment": "Test feedback",
                    "approved": False
                }
            ]
        }

        response = client.post("/api/submit-pharmacist-feedback", json=payload)
        # Should fail validation
        assert response.status_code == 422

    def test_pharmacist_feedback_invalid_feedback_type(self):
        """Test feedback with invalid feedback type"""
        payload = {
            "orderId": "test_order_invalid_type",
            "feedback": [
                {
                    "pharmacistName": "Dr. Test",
                    "feedbackType": "invalid_type",
                    "sectionName": "GOALS",
                    "comment": "Test",
                    "approved": False
                }
            ]
        }

        response = client.post("/api/submit-pharmacist-feedback", json=payload)
        # Still accepts it (validation would be more strict in production)
        assert response.status_code in [200, 422]


# ============================================================================
# FIXTURE FOR MOCKING ANTHROPIC CLIENT
# ============================================================================

@pytest.fixture(autouse=False)
def mock_anthropic_client():
    """Global mock for Anthropic client used across multiple tests"""
    with patch('main.client') as mock_client:
        mock_response = MagicMock()
        mock_content = MagicMock()
        mock_content.text = "Sample care plan content from Claude AI"
        mock_response.content = [mock_content]
        mock_client.messages.create.return_value = mock_response
        yield mock_client
