import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const AddComplaints = ({ onClose, onAddComplaint, medicines, existingComplaints }) => {
  const [complaintText, setComplaintText] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
  if (!complaintText || !selectedMedicine) {
    toast.error("Please fill in all fields.");
    return;
  }

  if (!Array.isArray(existingComplaints)) {
    toast.error("Complaint data is not ready yet.");
    return;
  }

  const exists = existingComplaints.some((c) => {
    const existingText = (c.complaintText || c.complaint || "").toLowerCase().trim();
    const currentText = complaintText.toLowerCase().trim();
    const existingMedId = String(c.medicineId || c.medicine || "");
    const selectedMedId = String(selectedMedicine);

    return existingText === currentText && existingMedId === selectedMedId;
  });

  if (exists) {
    toast.error("This complaint for the selected medicine already exists.");
    return; // stop here, don’t add duplicate
  }

  setIsSubmitting(true);
  await onAddComplaint(complaintText, selectedMedicine);
  setIsSubmitting(false);
  onClose();
};


  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2 style={styles.modalTitle}>Add Complaint</h2>
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Complaint:</label>
          <input
            type="text"
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            placeholder="Complaint"
            style={styles.inputField}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Medicine:</label>
          <select
            value={selectedMedicine}
            onChange={(e) => setSelectedMedicine(e.target.value)}
            style={styles.inputField}
          >
            <option value="">Select a medicine</option>
            {medicines.map((med) => (
              <option key={med.id} value={med.id}>
                {med.name}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.modalButtonContainer}>
          <button
            onClick={handleSubmit}
            style={styles.modalButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} style={styles.cancelButton}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    modalContent: {
      background: "#ffffff",
      padding: "30px",
      borderRadius: "12px",
      width: "100%",
      maxWidth: "480px",
      boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.15)",
      border: "1px solid #e0e0e0",
    },
    modalTitle: {
      fontSize: "22px",
      fontWeight: "bold",
      color: "#2563eb", // Medical blue
      marginBottom: "24px",
      textAlign: "center",
      borderBottom: "1px solid #e5e7eb",
      paddingBottom: "12px",
    },
    inputGroup: {
      marginBottom: "22px",
    },
    label: {
      display: "block",
      fontSize: "16px",
      color: "#374151",
      marginBottom: "8px",
      fontWeight: "bold",
    },
    inputField: {
      width: "80%",
      padding: "12px 14px",
      fontSize: "16px",
      borderRadius: "8px",
      border: "1px solid #d1d5db",
      backgroundColor: "#f9fafb",
      boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
      transition: "border-color 0.2s, box-shadow 0.2s",
      outline: "none",
      color: "black",
    },
    modalButtonContainer: {
      display: "flex",
      justifyContent: "space-between",
      gap: "14px",
      marginTop: "30px",
    },
    modalButton: {
      backgroundColor: "#2563eb", // Medical blue
      color: "white",
      padding: "12px 20px",
      borderRadius: "8px",
      border: "none",
      fontSize: "16px",
      fontWeight: "500",
      cursor: "pointer",
      flex: 1,
      transition: "background-color 0.3s",
      boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
    },
    modalButtonDisabled: {
      backgroundColor: "#93c5fd", // Lighter blue
      color: "white",
      padding: "12px 20px",
      borderRadius: "8px",
      border: "none",
      fontSize: "16px",
      fontWeight: "500",
      cursor: "not-allowed",
      flex: 1,
      boxShadow: "none",
    },
    cancelButton: {
      backgroundColor: "#f3f4f6",
      color: "#4b5563",
      padding: "12px 20px",
      borderRadius: "8px",
      border: "1px solid #d1d5db",
      fontSize: "16px",
      fontWeight: "500",
      cursor: "pointer",
      flex: 1,
      transition: "background-color 0.3s",
    },
  };
  
  export default AddComplaints;
