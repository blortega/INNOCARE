import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { app } from "../firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { FiPlus, FiEdit, FiTrash } from "react-icons/fi";
import EditModal from "../components/EditMedicine";
import AddMedicineForm from "../components/AddMedicineForm";
import InventoryAlert from "../components/InventoryAlert";
import FetchComplaints from "../hooks/FetchComplaints";
import AddComplaints from "../components/AddComplaints";
const formatDate = (date) => {
  // Return "N/A" if no date is provided
  if (!date) return "N/A";

  // If it's a Firestore Timestamp (has a .toDate function), convert it to a JavaScript Date
  if (typeof date.toDate === "function") {
    date = date.toDate();
  }

  // If it's a string, attempt to parse it into a valid date object
  if (typeof date === "string") {
    date = new Date(date);
  }

  // Ensure the date is valid
  const validDate = new Date(date);
  if (isNaN(validDate)) return "N/A"; // Invalid date handling

  // Format the date to "Month Day, Year" format
  const options = { year: "numeric", month: "long", day: "numeric" };
  return validDate.toLocaleDateString("en-US", options);
};

const Inventory = () => {
  const [medicines, setMedicines] = useState([]);
  const { complaints, loading, refetchComplaints } = FetchComplaints();
  const [search, setSearch] = useState("");
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveredComplaint, setIsHoveredComplaint] = useState(false);
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [restockAmount, setRestockAmount] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterOption, setFilterOption] = useState("default");
  const [selectedMedicineName, setSelectedMedicineName] = useState(null);

  const fetchMedicines = async () => {
    const db = getFirestore(app);
    const medicineCollection = collection(db, "medicine");
    const snapshot = await getDocs(medicineCollection);

    const medicineList = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const medicationDisplay = (data.medication || []).map((id) => {
          const found = complaints.find((c) => c.id === id);
          return found ? found.name : id;
        });

        return {
          id: doc.id,
          ...data,
          medicationDisplay,
        };
      })
    );

    setMedicines(medicineList);
  };

  useEffect(() => {
    if (!loading) fetchMedicines();
  }, [loading, complaints]);

  const filterMedicines = (medicine) => {
    const searchLower = search.toLowerCase();

    if (
      searchLower === "out of stock" ||
      searchLower === "in stock" ||
      searchLower === "low stock"
    ) {
      return medicine.status && medicine.status.toLowerCase() === searchLower;
    }

    const medicationString = Array.isArray(medicine.medication)
      ? medicine.medication.join(" ")
      : medicine.medication || "";

    const fieldToSearch = [
      medicine.name,
      medicationString,
      medicine.status,
      medicine.expiryDate ? medicine.expiryDate.toString() : "",
      medicine.expiryDate
        ? (medicine.expiryDate.seconds
            ? new Date(medicine.expiryDate.seconds * 1000)
            : new Date(medicine.expiryDate)
          ).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            day: "numeric",
          })
        : "",
      medicine.createdAt
        ? medicine.createdAt.toDate().toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            day: "numeric",
          })
        : "",
    ];

    return fieldToSearch.some(
      (field) => field && field.toLowerCase().includes(searchLower)
    );
  };

  const handleAddMedicine = async (newMedicine) => {
    try {
      console.log("adding medicine:", newMedicine);

      const db = getFirestore(app);
      const { medication = [], ...medicineData } = newMedicine;
      console.log("newMedicine.medication:", medication);
      // Add medicine to Firestore
      const docRef = await addDoc(collection(db, "medicine"), {
        ...medicineData,
        medication: newMedicine.medication,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expiryDate: newMedicine.expiryDate || "",
      });

      console.log("Document added with ID:", docRef.id);

      // ✅ Check and add new complaints to the 'complaints' collection
      const complaintsRef = collection(db, "complaints");
      const existingComplaintsSnap = await getDocs(complaintsRef);
      const existingComplaintNames = existingComplaintsSnap.docs.map(
        (doc) => doc.data().name
      );
      console.log("existingComplaintNames:", existingComplaintNames);
      const newComplaints = medication.filter(
        (name) => !existingComplaintNames.includes(name)
      );

      console.log("New Complaints to Add:", newComplaints);

      for (const complaint of newComplaints) {
        await addDoc(complaintsRef, {
          name: complaint,
          medicineName: newMedicine.name,
          createdAt: serverTimestamp(),
        });
      }

      // ✅ Fetch and update local state
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const addedMedicine = { id: docRef.id, ...docSnap.data() };
        setMedicines((prevMedicines) => [...prevMedicines, addedMedicine]);
        toast.success("Medicine added successfully!");
      } else {
        toast.error("Failed to retrieve added medicines");
      }
    } catch (error) {
      toast.error("Failed to add medicine!");
      console.error("Error adding medicine:", error);
    }

    fetchMedicines();
  };

  const handleAddComplaint = async (complaintText, selectedMedicineId) => {
    try {
      const db = getFirestore(app);

      // 1. Find the selected medicine object
      const selectedMed = medicines.find((m) => m.id === selectedMedicineId);
      if (!selectedMed) {
        toast.error("Selected medicine not found.");
        return;
      }

      // 2. Store complaint with proper medicineName
      const complaintsRef = collection(db, "complaints");
      await addDoc(complaintsRef, {
        name: complaintText,
        medicineName: selectedMed.name, // ✅ store actual medicine name
        createdAt: serverTimestamp(),
      });

      // 3. Update the medicine document to include the complaint name, not the ID
      const medicineRef = doc(db, "medicine", selectedMedicineId);
      const updatedMedication = [
        ...(selectedMed.medication || []),
        complaintText,
      ]; // ✅ store complaint name, not ID

      await updateDoc(medicineRef, {
        medication: updatedMedication,
      });

      toast.success("Complaint added and medicine updated!");

      // 4. Refresh complaints and medicines
      await refetchComplaints();
      fetchMedicines(); // You already have this defined
    } catch (err) {
      toast.error("Failed to add complaint");
      console.error("Error adding complaint: ", err);
    }
  };

  const getStockStatus = (stock) => {
    console.log("Stock value:", stock); // Add this line to check the value of stock

    // Ensure stock is a number
    stock = Number(stock);

    if (stock === 0) {
      return <div style={styles.noStockBadge}>Out of Stock</div>;
    } else if (stock <= 20 && stock > 0) {
      return <div style={styles.lowStockBadge}>Low Stock</div>;
    } else {
      return <div style={styles.inStockBadge}>In Stock</div>;
    }
  };

  const handleRestock = async (medicine, amount) => {
    try {
      const db = getFirestore(app);
      const medicineRef = doc(db, "medicine", medicine.id); // Reference to the specific document

      // Use getDoc instead of getDocs for fetching a single document
      const medicineSnapshot = await getDoc(medicineRef);

      if (!medicineSnapshot.exists()) {
        toast.error("Medicine not found!");
        return;
      }

      const currentStock = medicineSnapshot.data().stock;
      const newStock = currentStock + amount; // Calculate the new stock

      let newStatus = "";
      if (newStock > 20) {
        newStatus = "In Stock";
      } else if (newStock > 5) {
        newStatus = "Low Stock";
      } else {
        newStatus = "Out of Stock";
      }
      // Update the stock by adding the restock amount
      await updateDoc(medicineRef, {
        stock: newStock,
        status: newStatus,
        restockAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update the UI with the new stock
      setMedicines(
        medicines.map((item) =>
          item.id === medicine.id
            ? { ...item, stock: newStock, status: newStatus }
            : item
        )
      );

      toast.success(`${medicine.name} added ${restockAmount} unit/s`);
    } catch (error) {
      toast.error("Failed to restock!");
      console.error("Error restocking medicine:", error);
    }
  };

  const handleEdit = (medicine) => {
    setSelectedMedicine(medicine); // Set the selected medicine for editing
    setIsEditModalOpen(true);
  };

  const handleDelete = async (medicine) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${medicine.name}?`
    );
    if (confirmDelete) {
      try {
        const db = getFirestore(app);
        await deleteDoc(doc(db, "medicine", medicine.id));
        toast.success(`${medicine.name} has been deleted.`);
        setMedicines(medicines.filter((item) => item.id !== medicine.id)); // Remove it from the UI
      } catch (error) {
        toast.error("Failed to delete medicine.");
        console.error("Error deleting medicine:", error);
      }
    }
  };

  const handleUpdate = (updatedMedicine) => {
    setMedicines((prevMedicines) =>
      prevMedicines.map((medicine) =>
        medicine.id === updatedMedicine.id ? updatedMedicine : medicine
      )
    );
    fetchMedicines();
  };

  const handleModalOpen = (medicine) => {
    setSelectedMedicine(medicine);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setRestockAmount(0); // Clear the input when closing the modal
  };

  const FilterBy = () => {
    let filtered = medicines.filter(filterMedicines);

    switch (filterOption) {
      case "az":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "expiryDate":
        filtered.sort(
          (a, b) =>
            new Date(a.expiryDate?.toDate?.() || a.expiryDate) -
            new Date(b.expiryDate?.toDate?.() || b.expiryDate)
        );
        break;
      case "createdAt":
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt?.toDate?.() || a.createdAt) -
            new Date(b.createdAt?.toDate?.() || b.createdAt)
        );
        break;
      case "lowStock":
        filtered = filtered.filter(
          (item) => item.status?.toLowerCase() === "low stock"
        );
        break;
      case "outOfStock":
        filtered = filtered.filter(
          (item) => item.status?.toLowerCase() === "out of stock"
        );
        break;
      case "inStock":
        filtered = filtered.filter(
          (item) => item.status?.toLowerCase() === "in stock"
        );
        break;
      default:
        break;
    }

    return filtered;
  };

  return (
    <Sidebar>
      <div style={styles.container}>
        <ToastContainer position="top-right" autoClose={2000} />
        <div style={styles.dashboardContainer}>
          <div style={styles.dashboardHeader}>
            <h1 style={styles.dashboardTitle}>Inventory Page</h1>
            <p style={styles.dashboardDate}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        {/* Add Medicine Button */}
        <div style={styles.searchContainer}>
          <input
            style={styles.searchBar}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={styles.filterDropdown}
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value)}
          >
            <option value="default">Filter By</option>
            <option value="az">A - Z</option>
            <option value="za">Z - A</option>
            <option value="expiryDate">By Expiry Date</option>
            <option value="createdAt">By Created Date</option>
            <option value="lowStock">Low Stocks</option>
            <option value="outOfStock">Out of Stock</option>
            <option value="inStock">In Stock</option>
          </select>
          <div style={styles.buttonContainer}>
            <button
              onClick={() => setIsAddModalOpen(true)}
              style={
                isHovered
                  ? { ...styles.addUserButton, ...styles.buttonHover }
                  : styles.addUserButton
              }
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <FiPlus /> Add Medicine
            </button>
            <button
              style={
                isHoveredComplaint
                  ? { ...styles.addUserButton, ...styles.buttonHover }
                  : styles.addUserButton
              }
              onClick={() => setIsComplaintModalOpen(true)} // Open the Add Complaint modal
              onMouseEnter={() => setIsHoveredComplaint(true)}
              onMouseLeave={() => setIsHoveredComplaint(false)}
            >
              <FiPlus /> Add Complaint
            </button>
          </div>
        </div>

        <InventoryAlert medicines={medicines} />

        {/* Add Medicine Form Modal */}
        {isAddModalOpen && (
          <AddMedicineForm
            onClose={() => setIsAddModalOpen(false)}
            onAddMedicine={handleAddMedicine}
          />
        )}
        {/* Add Complaint Modal */}
        {isComplaintModalOpen && (
          <AddComplaints
            onClose={() => setIsComplaintModalOpen(false)} // Close the modal
            onAddComplaint={handleAddComplaint}
            medicines={medicines} // Pass the handler
          />
        )}
        {/* Medicine List */}
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.thead}>Medicine</th>
                <th style={styles.thead}>Medication</th>
                <th style={styles.thead}>Stocks</th>
                <th style={styles.thead}>Status</th>
                <th style={styles.thead}>Expiry Date</th>
                <th style={styles.thead}>Date Created</th>
                <th style={styles.thead}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {FilterBy().map((medicine, index) => {
                console.log(
                  `Medicine ${medicine.name} - expiryDate:`,
                  medicine.expiryDate
                );
                console.log(
                  `Medicine ${medicine.name} - createdAt:`,
                  medicine.createdAt
                );

                return (
                  <tr key={index}>
                    <td style={styles.tdata}>{medicine.name}</td>
                    <td style={styles.tdata}>
                      {Array.isArray(medicine.medicationDisplay) &&
                      medicine.medicationDisplay.length > 0 ? (
                        <ul style={styles.bulletList}>
                          {medicine.medicationDisplay.map(
                            (complaintName, index) => (
                              <li key={index}>{complaintName}</li>
                            )
                          )}
                        </ul>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "#888" }}>
                          No complaints
                        </span>
                      )}
                    </td>
                    <td style={styles.tdata}>{medicine.stock}</td>
                    <td style={styles.tdata}>
                      {getStockStatus(medicine.stock)}
                    </td>
                    <td style={styles.tdata}>
                      {formatDate(medicine.expiryDate)}
                    </td>
                    <td style={styles.tdata}>
                      {formatDate(medicine.createdAt)}
                    </td>
                    <td style={styles.tdata}>
                      <button
                        style={
                          hoveredUser === medicine.id && hoveredIcon === "add"
                            ? {
                                ...styles.iconButton,
                                ...styles.iconButtonHover,
                              }
                            : styles.iconButton
                        }
                        onMouseEnter={() => {
                          setHoveredUser(medicine.id);
                          setHoveredIcon("add");
                        }}
                        onMouseLeave={() => setHoveredIcon(null)}
                        onClick={() => handleModalOpen(medicine)}
                        title="Add"
                      >
                        <FiPlus />
                      </button>
                      <button
                        style={
                          hoveredUser === medicine.id && hoveredIcon === "edit"
                            ? {
                                ...styles.iconButton,
                                ...styles.iconButtonHover,
                              }
                            : styles.iconButton
                        }
                        onMouseEnter={() => {
                          setHoveredUser(medicine.id);
                          setHoveredIcon("edit");
                        }}
                        onMouseLeave={() => setHoveredIcon(null)}
                        onClick={() => handleEdit(medicine)}
                        title="Edit"
                      >
                        <FiEdit />
                      </button>
                      <button
                        style={
                          hoveredUser === medicine.id &&
                          hoveredIcon === "delete"
                            ? {
                                ...styles.iconButton,
                                ...styles.iconButtonHover,
                              }
                            : styles.iconButton
                        }
                        onMouseEnter={() => {
                          setHoveredUser(medicine.id);
                          setHoveredIcon("delete");
                        }}
                        onMouseLeave={() => setHoveredIcon(null)}
                        onClick={() => handleDelete(medicine)}
                        title="Delete"
                      >
                        <FiTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Restock Modal */}
        {isModalOpen && (
          <RestockModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            medicine={selectedMedicine}
            onRestock={handleRestock}
            restockAmount={restockAmount}
            setRestockAmount={setRestockAmount}
          />
        )}

        {/* Edit Modal */}
        {isEditModalOpen && (
          <EditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)} // Close modal
            medicine={selectedMedicine}
            onUpdate={handleUpdate} // Pass the update handler
          />
        )}
      </div>
    </Sidebar>
  );
};

const RestockModal = ({
  isOpen,
  onClose,
  medicine,
  onRestock,
  restockAmount,
  setRestockAmount,
}) => {
  const handleRestockChange = (e) => {
    const value = e.target.value;
    if (value === "" || (/^\d+$/.test(value) && Number(value) >= 0)) {
      setRestockAmount(value);
    }
  };

  const handleIncrease = () => {
    setRestockAmount((prevAmount) => parseInt(prevAmount) + 1);
  };

  const handleDecrease = () => {
    setRestockAmount((prevAmount) => {
      const newAmount = parseInt(prevAmount) - 1;
      return newAmount >= 0 ? newAmount : 0; // Prevent going below 0
    });
  };

  const handleSubmit = async () => {
    const confirmStock = window.confirm(
      `Proceed to add stock for ${medicine.name}?`
    );
    if (!confirmStock) {
      return;
    }

    if (restockAmount <= 0) {
      toast.error("Please enter a valid restock amount.");
      return;
    }
    await onRestock(medicine, parseInt(restockAmount));
    setRestockAmount(0); // Clear the input field after restocking
    onClose(); // Close the modal after restocking
  };

  if (!isOpen) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2 style={styles.modalTitle}>Add Stock</h2>
        <p style={styles.modalDescription}>
          You are about to add stock for <strong>{medicine.name}</strong>.
        </p>
        <p style={styles.modalDescription}>
          Please enter the amount you want to add to the stock.
        </p>

        {/* Display Current Stock */}
        <p style={styles.currentStockText}>
          <strong>Current Stock:</strong> {medicine.stock} unit/s
        </p>

        <div style={styles.inputGroup}>
          <label style={styles.label}>
            Stock Amount:
            <div style={styles.inputWrapper}>
              <button
                type="button"
                onClick={handleDecrease}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={styles.decreaseButton}
              >
                -
              </button>
              <input
                type="number"
                value={restockAmount}
                onChange={handleRestockChange}
                onKeyDown={(e) => {
                  if (
                    e.key === "-" ||
                    e.key === "e" ||
                    e.key === "+" ||
                    e.key === "."
                  ) {
                    e.preventDefault(); // Block minus sign and other unwanted chars
                  }
                }}
                style={styles.inputField}
                min="0"
                placeholder="Enter number of items"
              />
              <button
                type="button"
                onClick={handleIncrease}
                style={styles.increaseButton}
              >
                +
              </button>
            </div>
          </label>
        </div>

        <div style={styles.modalButtonContainer}>
          <button onClick={handleSubmit} style={styles.modalButton}>
            Add
          </button>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "24px",
    textAlign: "center",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
  },
  text: {
    color: "#2563eb",
    fontSize: "45px",
  },
  dashboardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    paddingBottom: "12px",
    borderBottom: "1px solid #e0e4e8",
  },
  dashboardTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#2563eb",
    margin: 0,
  },
  dashboardDate: {
    color: "#7f8c8d",
    fontSize: "14px",
    fontWeight: "bold",
    margin: 0,
  },
  searchContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "85%",
    margin: "0 auto 22px auto",
    gap: "12px",
  },
  searchBar: {
    width: "28%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#334155",
    fontSize: "15px",
    boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)",
    transition: "border-color 0.2s",
  },
  filterDropdown: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#334155",
    marginLeft: "10px",
    boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)",
    fontSize: "15px",
  },
  bulletList: {
    paddingLeft: "20px",
    margin: 0,
    listStyleType: "disc",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    marginTop: "6px",
    marginBottom: "16px",
  },
  buttonHover: {
    backgroundColor: "#1e40af",
  },
  addUserButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 18px",
    borderRadius: "8px",
    border: "none",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    backgroundColor: "#2563eb", // Medical blue
    transition: "background-color 0.3s",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  addIcon: {
    fontSize: "20px",
  },
  card: {
    width: "85%",
    margin: "auto",
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.08)",
    backgroundColor: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    color: "#334155",
  },
  thead: {
    padding: "14px 16px",
    background: "#2563eb", // Medical blue
    color: "#fff",
    borderBottom: "2px solid #ddd",
    fontSize: "18px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  tdata: {
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    borderRight: "1px solid #e2e8f0",
    color: "#334155",
    textAlign: "center",
    fontSize: "18px",
  },
  iconButton: {
    color: "#1e3a8a",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    margin: "0 5px",
  },
  iconButtonHover: {
    color: "#d41c48",
    transform: "scale(1.1)",
  },
  lowStockBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "12px",
    backgroundColor: "#fbbf24", // Warning amber
    color: "#1e293b",
    fontWeight: "600",
    fontSize: "14px",
  },
  inStockBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "12px",
    backgroundColor: "#10b981", // Healthy green
    color: "#fff",
    fontWeight: "600",
    fontSize: "14px",
  },
  noStockBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "12px",
    backgroundColor: "#ef4444", // Alert red
    color: "#fff",
    fontWeight: "600",
    fontSize: "14px",
  },
  currentStockText: {
    fontSize: "16px",
    color: "#334155",
    marginBottom: "18px",
    fontWeight: "600",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "24px",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  decreaseButton: {
    backgroundColor: "#f87171", // Softer red
    color: "white",
    border: "none",
    padding: "10px 16px",
    fontSize: "16px",
    cursor: "pointer",
    borderRadius: "8px",
    margin: "0 10px",
    transition: "background-color 0.3s",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  increaseButton: {
    backgroundColor: "#34d399", // Softer green
    color: "white",
    border: "none",
    padding: "10px 16px",
    fontSize: "16px",
    cursor: "pointer",
    borderRadius: "8px",
    margin: "0 10px",
    transition: "background-color 0.3s",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1050,
  },
  modalContent: {
    background: "#fff",
    padding: "32px",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.12)",
    border: "1px solid #e2e8f0",
  },
  modalTitle: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#2563eb", // Medical blue
    marginBottom: "18px",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: "12px",
    textAlign: "center",
  },
  modalDescription: {
    fontSize: "16px",
    color: "#4b5563",
    marginBottom: "16px",
    lineHeight: "1.5",
    textAlign: "left",
  },
  label: {
    fontSize: "16px",
    color: "#334155",
    marginBottom: "10px",
    display: "block",
    textAlign: "left",
    fontWeight: "500",
  },
  inputField: {
    fontSize: "16px",
    padding: "12px 14px",
    width: "100%",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    marginBottom: "16px",
    textAlign: "left",
    backgroundColor: "#f8fafc",
    boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)",
    color: "#334155",
  },
  modalButtonContainer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    marginTop: "8px",
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
  cancelButton: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    padding: "12px 20px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    flex: 1,
    transition: "background-color 0.3s",
  },
};

export default Inventory;
