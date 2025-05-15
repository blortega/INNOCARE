import React, { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Sidebar from "../components/Sidebar";
import { db } from "../firebase";
import { FaTrash, FaEye, FaPrint } from "react-icons/fa";
import "../styles/Records.css";
import logo from "../assets/innodatalogo.png"; // Fixed path with proper slash

const ThirdPartyRecord = () => {
  const [records, setRecords] = useState([]);
  const [hoveredRecord, setHoveredRecord] = useState(null);
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

  // Inline styles for the enhanced controls
  const styles = {
    controlsRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      backgroundColor: "#f9fafb",
      padding: "15px",
      borderRadius: "8px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
    filterContainer: {
      display: "flex",
      alignItems: "center",
    },
    filterLabel: {
      fontWeight: "600",
      marginRight: "10px",
      color: "#374151",
    },
    select: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      backgroundColor: "white",
      color: "#1f2937",
      fontSize: "14px",
      minWidth: "180px",
      cursor: "pointer",
      transition: "all 0.2s",
      outline: "none",
      marginRight: "15px",
    },
    printButton: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#3b82f6",
      color: "white",
      padding: "8px 16px",
      border: "none",
      borderRadius: "6px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background-color 0.2s",
    },
    printButtonHover: {
      backgroundColor: "#2563eb",
    },
    printIcon: {
      marginRight: "8px",
    },
  };

  const months = [
    { label: "January", value: 1 },
    { label: "February", value: 2 },
    { label: "March", value: 3 },
    { label: "April", value: 4 },
    { label: "May", value: 5 },
    { label: "June", value: 6 },
    { label: "July", value: 7 },
    { label: "August", value: 8 },
    { label: "September", value: 9 },
    { label: "October", value: 10 },
    { label: "November", value: 11 },
    { label: "December", value: 12 },
  ];

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "thirdpartyRequests"));
      let recordList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          employeeID: data.employeeID || "Not Available",
          firstname: data.firstname || "",
          middleInitial: data.middleInitial || "",
          lastname: data.lastname || "",
          fullName: data.firstname
            ? `${data.firstname} ${
                data.middleInitial ? data.middleInitial + ". " : ""
              }${data.lastname || ""}`
            : "Not Available",
          gender: data.gender || "Not Available",
          medicine: data.medicine || "Not Available",
          complaint: data.complaint || "Not Available",
          status: data.status || "Pending",
          date: data.dateVisit?.toDate().toLocaleString() || "N/A",
          rawDate: data.dateVisit,
          dateVisit: data.dateVisit,
          additionalNotes: data.additionalNotes || "None",
        };
      });

      // Extract all unique years from the records and sort them
      const years = new Set();
      recordList.forEach((record) => {
        if (record.dateVisit) {
          const recordDate = new Date(record.dateVisit.seconds * 1000);
          years.add(recordDate.getFullYear());
        }
      });

      // Convert Set to Array, sort in descending order (newest first)
      const uniqueYears = Array.from(years).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

      // Set default year to the most recent year if there are records
      if (uniqueYears.length > 0 && !selectedYear) {
        setSelectedYear(uniqueYears[0]);
      }

      // Filter records by selected year and month
      if (selectedYear || selectedMonth) {
        recordList = recordList.filter((record) => {
          if (!record.dateVisit) return false;

          const recordDate = new Date(record.dateVisit.seconds * 1000); // convert timestamp to date
          const recordYear = recordDate.getFullYear();
          const recordMonth = recordDate.getMonth() + 1; // getMonth() returns 0-based index

          // Filter by year if selected
          if (selectedYear && recordYear !== selectedYear) {
            return false;
          }

          // Filter by month if selected
          if (selectedMonth && recordMonth !== selectedMonth) {
            return false;
          }

          return true;
        });
      }

      recordList.sort((a, b) => {
        if (!a.rawDate) return 1;
        if (!b.rawDate) return -1;
        return b.rawDate.seconds - a.rawDate.seconds;
      });

      setRecords(recordList);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast.error("Failed to load records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedYear]);

  const handleView = (record) => {
    setSelectedRecord(record);
    setModalVisible(true);
  };

  const handleDelete = async (record) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the record for ${record.fullName}?`
    );
    if (!confirmDelete) return;

    setDeletingId(record.id);
    try {
      await deleteDoc(doc(db, "thirdpartyRequests", record.id));
      toast.success("ThirdPartyRecord deleted successfully!");
      await fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Failed to delete record.");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open("", "_blank");

    // Convert logo to base64 to use in the print window
    const img = new Image();
    img.src = logo;

    img.onload = () => {
      // Create a canvas element to draw the image
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Get base64 representation of the image
      const logoBase64 = canvas.toDataURL("image/png");

      // Create title based on selected filters
      let reportTitle = "Medicine Request Records";
      if (selectedMonth && selectedYear) {
        const monthName = months.find((m) => m.value === selectedMonth)?.label;
        reportTitle = `Medicine Request Records - ${monthName} ${selectedYear}`;
      } else if (selectedMonth) {
        const monthName = months.find((m) => m.value === selectedMonth)?.label;
        reportTitle = `Medicine Request Records - ${monthName}`;
      } else if (selectedYear) {
        reportTitle = `Medicine Request Records - ${selectedYear}`;
      }

      // Create a simple HTML content for the print window
      const printContent = `
        <html>
          <head>
            <title>Print Records</title>
            <style>
              body { font-family: Arial, sans-serif; }
              .header { display: flex; align-items: center; margin-bottom: 20px; }
              .logo { height: 60px; margin-right: 20px; }
              .header-text { flex: 1; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .status-badge { padding: 3px 8px; color: white; font-size: 12px; border-radius: 3px; }
              .print-date { font-size: 12px; color: #666; margin-top: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoBase64}" alt="Innodata Logo" class="logo">
              <div class="header-text">
                <h2>${reportTitle}</h2>
                <p class="print-date">Printed on: ${new Date().toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                <th>No.</th>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Medicine</th>
                  <th>Complaint</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${records
                  .map(
                    (record, index) => `
                    <tr>
                      <td>${index + 1}</td>
                        <td>${record.employeeID}</td>
                        <td>${record.fullName}</td>
                        <td>${record.gender}</td>
                        <td>${record.medicine}</td>
                        <td>${record.complaint}</td>
                        <td><span class="status-badge" style="background-color: ${
                          record.status === "Approved"
                            ? "#10b981"
                            : record.status === "Completed"
                            ? "#10b981"
                            : record.status === "Rejected"
                            ? "#ef4444"
                            : record.status === "Pending"
                            ? "#f59e0b"
                            : "#6b7280"
                        }">${record.status}</span></td>
                        <td>${record.date}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Write the content to the print window and trigger the print dialog
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait a bit for the content to load properly before printing
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };

    // Handle loading error
    img.onerror = () => {
      console.error("Error loading logo for printing");
      // Fallback to printing without logo

      // Create title based on selected filters
      let reportTitle = "Medicine Request Records";
      if (selectedMonth && selectedYear) {
        const monthName = months.find((m) => m.value === selectedMonth)?.label;
        reportTitle = `Medicine Request Records - ${monthName} ${selectedYear}`;
      } else if (selectedMonth) {
        const monthName = months.find((m) => m.value === selectedMonth)?.label;
        reportTitle = `Medicine Request Records - ${monthName}`;
      } else if (selectedYear) {
        reportTitle = `Medicine Request Records - ${selectedYear}`;
      }

      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    };
  };

  const [isPrintHovered, setIsPrintHovered] = useState(false);

  return (
    <Sidebar>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="records-container">
        <div className="dashboard-header">
          <h1>Medicine Request Records</h1>
          <p className="dashboard-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Controls Row - Filters and Print Button */}
        <div style={styles.controlsRow}>
          {/* Filters Container */}
          <div style={styles.filterContainer}>
            {/* Year Filter */}
            <label style={styles.filterLabel}>Year:</label>
            <select
              onChange={(e) =>
                setSelectedYear(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              value={selectedYear || ""}
              style={styles.select}
            >
              <option value="">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            {/* Month Filter */}
            <label style={styles.filterLabel}>Month:</label>
            <select
              onChange={(e) =>
                setSelectedMonth(
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              value={selectedMonth || ""}
              style={styles.select}
            >
              <option value="">All Months</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            style={
              isPrintHovered
                ? { ...styles.printButton, ...styles.printButtonHover }
                : styles.printButton
            }
            onMouseEnter={() => setIsPrintHovered(true)}
            onMouseLeave={() => setIsPrintHovered(false)}
          >
            <FaPrint style={styles.printIcon} /> Print Records
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <table className="records-table">
              <thead>
                <tr>
                  <th className="table-head" style={{ width: "60px" }}>
                    No.
                  </th>
                  <th className="table-head" style={{ width: "100px" }}>
                    Employee ID
                  </th>
                  <th className="table-head" style={{ width: "150px" }}>
                    Name
                  </th>
                  <th className="table-head" style={{ width: "120px" }}>
                    Gender
                  </th>
                  <th className="table-head" style={{ width: "120px" }}>
                    Medicine
                  </th>
                  <th className="table-head" style={{ width: "150px" }}>
                    Complaint
                  </th>
                  <th className="table-head" style={{ width: "100px" }}>
                    Status
                  </th>
                  <th className="table-head" style={{ width: "150px" }}>
                    Date
                  </th>
                  <th className="table-head" style={{ width: "100px" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record, index) => (
                    <tr
                      key={record.id}
                      className={`table-row ${
                        index % 2 === 0 ? "even-row" : "odd-row"
                      }`}
                    >
                      <td className="table-cell">{index + 1}</td>
                      <td className="table-cell">{record.employeeID}</td>
                      <td className="table-cell">{record.fullName}</td>
                      <td className="table-cell">{record.gender}</td>
                      <td className="table-cell">{record.medicine}</td>
                      <td className="table-cell">{record.complaint}</td>
                      <td className="table-cell">
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor:
                              record.status === "Approved"
                                ? "#10b981"
                                : record.status === "Completed"
                                ? "#10b981"
                                : record.status === "Rejected"
                                ? "#ef4444"
                                : record.status === "Pending"
                                ? "#f59e0b"
                                : "#6b7280",
                          }}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="table-cell">{record.date}</td>
                      <td className="action-cell">
                        <button
                          className={`icon-button ${
                            hoveredRecord === record.id &&
                            hoveredIcon === "view"
                              ? "button-hover"
                              : ""
                          }`}
                          onMouseEnter={() => {
                            setHoveredRecord(record.id);
                            setHoveredIcon("view");
                          }}
                          onMouseLeave={() => setHoveredIcon(null)}
                          onClick={() => handleView(record)}
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        <button
                          className={`icon-button ${
                            hoveredRecord === record.id &&
                            hoveredIcon === "delete"
                              ? "button-hover"
                              : ""
                          }`}
                          onMouseEnter={() => {
                            setHoveredRecord(record.id);
                            setHoveredIcon("delete");
                          }}
                          onMouseLeave={() => setHoveredIcon(null)}
                          onClick={() => handleDelete(record)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="9"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      No records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {modalVisible && selectedRecord && (
        <div className="record-modal" onClick={() => setModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Medicine Request Details</h2>
            {/* Modal Content */}
            <div className="form-row">
              <div className="third-width">
                <div className="form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    value={selectedRecord.firstname}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
              <div className="third-width">
                <div className="form-group">
                  <label>Middle Initial:</label>
                  <input
                    type="text"
                    value={selectedRecord.middleInitial}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
              <div className="third-width">
                <div className="form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    value={selectedRecord.lastname}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
            </div>
            {/* Gender and Medicine Row */}
            <div className="form-row">
              <div className="half-width">
                <div className="form-group">
                  <label>Gender:</label>
                  <input
                    type="text"
                    value={selectedRecord.gender}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
              <div className="half-width">
                <div className="form-group">
                  <label>Medicine:</label>
                  <input
                    type="text"
                    value={selectedRecord.medicine}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
            </div>
            {/* Complaint, Date, and Notes Row */}
            <div className="form-row">
              <div className="half-width">
                <div className="form-group">
                  <label>Complaint:</label>
                  <input
                    type="text"
                    value={selectedRecord.complaint}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
              <div className="half-width">
                <div className="form-group">
                  <label>Additional Notes:</label>
                  <textarea
                    value={selectedRecord.additionalNotes}
                    className="record-input"
                    disabled
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setModalVisible(false)}
              className="close-modal-btn"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Sidebar>
  );
};

export default ThirdPartyRecord;
