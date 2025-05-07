import { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  FileText,
  RefreshCw,
  User,
  UserPlus,
  Clock,
} from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";

const Reports = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [medicineData, setMedicineData] = useState([]);
  const [maleComplaintsData, setMaleComplaintsData] = useState([]);
  const [femaleComplaintsData, setFemaleComplaintsData] = useState([]);
  const [maleAgeBracketData, setMaleAgeBracketData] = useState([]);
  const [femaleAgeBracketData, setFemaleAgeBracketData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Process medicine request data
  const processMedicineRequests = (data) => {
    // Count medicines
    const medicineCounts = {};
    const maleComplaints = {};
    const femaleComplaints = {};

    data.forEach((request) => {
      // Count medicines
      const medicine = request.medicine;
      if (medicine) {
        medicineCounts[medicine] = (medicineCounts[medicine] || 0) + 1;
      }

      // Count complaints by gender
      const complaint = request.complaint;
      const gender = request.gender;

      if (complaint && gender) {
        if (gender === "Male") {
          maleComplaints[complaint] = (maleComplaints[complaint] || 0) + 1;
        } else if (gender === "Female") {
          femaleComplaints[complaint] = (femaleComplaints[complaint] || 0) + 1;
        }
      }
    });

    // Convert to array format for display
    const medicineData = Object.keys(medicineCounts)
      .map((medicine) => ({
        medicineName: medicine,
        count: medicineCounts[medicine],
      }))
      .sort((a, b) => b.count - a.count);

    const maleComplaintsData = Object.keys(maleComplaints)
      .map((complaint) => ({ complaint, count: maleComplaints[complaint] }))
      .sort((a, b) => b.count - a.count);

    const femaleComplaintsData = Object.keys(femaleComplaints)
      .map((complaint) => ({ complaint, count: femaleComplaints[complaint] }))
      .sort((a, b) => b.count - a.count);

    return { medicineData, maleComplaintsData, femaleComplaintsData };
  };

  // Process age bracket data from users with gender separation
  const processAgeBrackets = (users) => {
    const maleAgeBrackets = {
      "18-25": 0,
      "26-35": 0,
      "36-45": 0,
      "46-55": 0,
      "55+": 0,
    };

    const femaleAgeBrackets = {
      "18-25": 0,
      "26-35": 0,
      "36-45": 0,
      "46-55": 0,
      "55+": 0,
    };

    const today = new Date();

    users.forEach((user) => {
      if (user.dob && user.gender) {
        // Convert Firestore timestamp to JavaScript Date if necessary
        const dob = user.dob instanceof Date ? user.dob : user.dob.toDate();

        // Calculate age
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();

        // Adjust age if birthday hasn't occurred yet this year
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < dob.getDate())
        ) {
          age--;
        }

        // Get the appropriate bracket object based on gender
        const brackets =
          user.gender === "Male"
            ? maleAgeBrackets
            : user.gender === "Female"
            ? femaleAgeBrackets
            : null;

        // If we have a valid gender, increment the appropriate age bracket
        if (brackets) {
          if (age >= 18 && age <= 25) {
            brackets["18-25"]++;
          } else if (age > 25 && age <= 35) {
            brackets["26-35"]++;
          } else if (age > 35 && age <= 45) {
            brackets["36-45"]++;
          } else if (age > 45 && age <= 55) {
            brackets["46-55"]++;
          } else if (age > 55) {
            brackets["55+"]++;
          }
        }
      }
    });

    // Convert to array format for display - male
    const maleData = Object.keys(maleAgeBrackets).map((bracket) => ({
      bracket,
      count: maleAgeBrackets[bracket],
      gender: "Male",
    }));

    // Convert to array format for display - female
    const femaleData = Object.keys(femaleAgeBrackets).map((bracket) => ({
      bracket,
      count: femaleAgeBrackets[bracket],
      gender: "Female",
    }));

    // Return combined data
    return { maleAgeBracketData: maleData, femaleAgeBracketData: femaleData };
  };

  // Fetch data from Firestore based on selected month and year
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Calculate start and end date for the selected month
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(
          selectedYear,
          selectedMonth + 1,
          0,
          23,
          59,
          59
        );

        // Query medicine requests
        const medicineRequestsRef = collection(db, "medicineRequests");
        const medicineQuery = query(
          medicineRequestsRef,
          where("dateVisit", ">=", startDate),
          where("dateVisit", "<=", endDate)
        );

        const medicineSnapshot = await getDocs(medicineQuery);
        const requests = [];

        medicineSnapshot.forEach((doc) => {
          requests.push(doc.data());
        });

        // Process the medicine request data
        const { medicineData, maleComplaintsData, femaleComplaintsData } =
          processMedicineRequests(requests);

        // Query users collection for age bracket
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        const users = [];

        usersSnapshot.forEach((doc) => {
          users.push(doc.data());
        });

        // Process age bracket data
        const { maleAgeBracketData, femaleAgeBracketData } =
          processAgeBrackets(users);

        // Update state
        setMedicineData(medicineData);
        setMaleComplaintsData(maleComplaintsData);
        setFemaleComplaintsData(femaleComplaintsData);
        setMaleAgeBracketData(maleAgeBracketData);
        setFemaleAgeBracketData(femaleAgeBracketData);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedYear]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handleMonthChange = (e) => {
    setSelectedMonth(parseInt(e.target.value));
  };

  const handleYearChange = (e) => {
    setSelectedYear(parseInt(e.target.value));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Re-trigger the useEffect
    const fetchData = async () => {
      try {
        // Same fetchData logic from the useEffect
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(
          selectedYear,
          selectedMonth + 1,
          0,
          23,
          59,
          59
        );

        const medicineRequestsRef = collection(db, "medicineRequests");
        const medicineQuery = query(
          medicineRequestsRef,
          where("dateVisit", ">=", startDate),
          where("dateVisit", "<=", endDate)
        );

        const medicineSnapshot = await getDocs(medicineQuery);
        const requests = [];

        medicineSnapshot.forEach((doc) => {
          requests.push(doc.data());
        });

        const { medicineData, maleComplaintsData, femaleComplaintsData } =
          processMedicineRequests(requests);

        // Query users collection for age bracket
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        const users = [];

        usersSnapshot.forEach((doc) => {
          users.push(doc.data());
        });

        // Process age bracket data
        const { maleAgeBracketData, femaleAgeBracketData } =
          processAgeBrackets(users);

        setMedicineData(medicineData);
        setMaleComplaintsData(maleComplaintsData);
        setFemaleComplaintsData(femaleComplaintsData);
        setMaleAgeBracketData(maleAgeBracketData);
        setFemaleAgeBracketData(femaleAgeBracketData);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  };

  // Function to export data as CSV
  const exportData = () => {
    // Create CSV content for medicines
    let csvContent = "data:text/csv;charset=utf-8,";

    // Medicine data
    csvContent += "Medical Reports\r\n";
    csvContent += "Medicine Name,Count\r\n";
    medicineData.forEach((item) => {
      csvContent += `${item.medicineName},${item.count}\r\n`;
    });
    csvContent += `Total,${medicineData.reduce(
      (sum, item) => sum + item.count,
      0
    )}\r\n\r\n`;

    // Male complaints
    csvContent += "Male Complaints\r\n";
    csvContent += "Complaint,Count\r\n";
    maleComplaintsData.forEach((item) => {
      csvContent += `${item.complaint},${item.count}\r\n`;
    });
    csvContent += `Total,${maleComplaintsData.reduce(
      (sum, item) => sum + item.count,
      0
    )}\r\n\r\n`;

    // Female complaints
    csvContent += "Female Complaints\r\n";
    csvContent += "Complaint,Count\r\n";
    femaleComplaintsData.forEach((item) => {
      csvContent += `${item.complaint},${item.count}\r\n`;
    });
    csvContent += `Total,${femaleComplaintsData.reduce(
      (sum, item) => sum + item.count,
      0
    )}\r\n\r\n`;

    // Male Age brackets
    csvContent += "Male Age Brackets\r\n";
    csvContent += "Age Range,Count\r\n";
    maleAgeBracketData.forEach((item) => {
      csvContent += `${item.bracket},${item.count}\r\n`;
    });
    csvContent += `Total Males,${maleAgeBracketData.reduce(
      (sum, item) => sum + item.count,
      0
    )}\r\n\r\n`;

    // Female Age brackets
    csvContent += "Female Age Brackets\r\n";
    csvContent += "Age Range,Count\r\n";
    femaleAgeBracketData.forEach((item) => {
      csvContent += `${item.bracket},${item.count}\r\n`;
    });
    csvContent += `Total Females,${femaleAgeBracketData.reduce(
      (sum, item) => sum + item.count,
      0
    )}\r\n\r\n`;

    // Combined total
    csvContent += `Total Users,${
      maleAgeBracketData.reduce((sum, item) => sum + item.count, 0) +
      femaleAgeBracketData.reduce((sum, item) => sum + item.count, 0)
    }\r\n`;

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Medical_Reports_${monthNames[selectedMonth]}_${selectedYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Sidebar>
      <div style={styles.container}>
        <div style={styles.dashboardContainer}>
          <div style={styles.dashboardHeader}>
            <h1 style={styles.dashboardTitle}>Reports</h1>
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

        {/* Content */}
        <div style={styles.content}>
          {/* Controls */}
          <div style={styles.card}>
            <div style={styles.row}>
              <div style={styles.row}>
                <div style={styles.row}>
                  <Calendar
                    style={{ marginRight: 8, color: "#2c7a7b" }}
                    size={20}
                  />
                  <select
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    style={styles.select}
                    aria-label="Select month"
                  >
                    {monthNames.map((month, index) => (
                      <option key={index} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={selectedYear}
                  onChange={handleYearChange}
                  style={styles.select}
                  aria-label="Select year"
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={styles.row}>
                <button
                  onClick={handleRefresh}
                  style={styles.buttonSecondary}
                  aria-label="Refresh data"
                >
                  <RefreshCw size={16} style={{ marginRight: 8 }} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={exportData}
                  style={styles.buttonPrimary}
                  aria-label="Export data as CSV"
                >
                  <Download size={16} style={{ marginRight: 8 }} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Section */}
          {isLoading ? (
            <div style={styles.loadingBox}>
              <div style={{ color: "#2c7a7b", textAlign: "center" }}>
                <RefreshCw
                  size={30}
                  className="animate-spin"
                  style={{ marginBottom: 8 }}
                />
                <div>Loading data...</div>
              </div>
            </div>
          ) : error ? (
            <div style={styles.loadingBox}>
              <div style={{ color: "#e53e3e", textAlign: "center" }}>
                <div style={{ marginBottom: 8 }}>⚠️ {error}</div>
                <button onClick={handleRefresh} style={styles.buttonSecondary}>
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.summaryContainer}>
              {/* Common Requested Medicine */}
              <div style={styles.card}>
                <div style={styles.sectionTitle}>
                  <FileText
                    size={20}
                    style={{ marginRight: 12, color: "#2c7a7b" }}
                  />
                  Common Requested Medicine
                </div>
                <div style={{ overflowY: "auto", maxHeight: 384 }}>
                  {medicineData.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.tableHeader}>Medicine Name</th>
                          <th
                            style={{
                              ...styles.tableHeader,
                              textAlign: "right",
                            }}
                          >
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {medicineData.map((item, index) => (
                          <tr key={index}>
                            <td style={styles.tableCell}>
                              {item.medicineName}
                            </td>
                            <td
                              style={{
                                ...styles.tableCell,
                                textAlign: "right",
                              }}
                            >
                              {item.count}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td style={styles.tableCell}>Total</td>
                          <td
                            style={{
                              ...styles.tableCell,
                              textAlign: "right",
                              fontWeight: "bold",
                            }}
                          >
                            {medicineData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: "#718096",
                      }}
                    >
                      No medicine data available for this period
                    </div>
                  )}
                </div>
              </div>

              {/* Complaints by Male */}
              <div style={styles.card}>
                <div style={styles.sectionTitle}>
                  <User
                    size={20}
                    style={{ marginRight: 12, color: "#2c7a7b" }}
                  />
                  Complaints by Male
                </div>
                <div style={{ overflowY: "auto", maxHeight: 384 }}>
                  {maleComplaintsData.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.tableHeader}>Complaint</th>
                          <th
                            style={{
                              ...styles.tableHeader,
                              textAlign: "right",
                            }}
                          >
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {maleComplaintsData.map((item, index) => (
                          <tr key={index}>
                            <td style={styles.tableCell}>{item.complaint}</td>
                            <td
                              style={{
                                ...styles.tableCell,
                                textAlign: "right",
                              }}
                            >
                              {item.count}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td style={styles.tableCell}>Total</td>
                          <td
                            style={{
                              ...styles.tableCell,
                              textAlign: "right",
                              fontWeight: "bold",
                            }}
                          >
                            {maleComplaintsData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: "#718096",
                      }}
                    >
                      No male complaint data available for this period
                    </div>
                  )}
                </div>
              </div>

              {/* Complaints by Female */}
              <div style={styles.card}>
                <div style={styles.sectionTitle}>
                  <UserPlus
                    size={20}
                    style={{ marginRight: 12, color: "#2c7a7b" }}
                  />
                  Complaints by Female
                </div>
                <div style={{ overflowY: "auto", maxHeight: 384 }}>
                  {femaleComplaintsData.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.tableHeader}>Complaint</th>
                          <th
                            style={{
                              ...styles.tableHeader,
                              textAlign: "right",
                            }}
                          >
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {femaleComplaintsData.map((item, index) => (
                          <tr key={index}>
                            <td style={styles.tableCell}>{item.complaint}</td>
                            <td
                              style={{
                                ...styles.tableCell,
                                textAlign: "right",
                              }}
                            >
                              {item.count}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td style={styles.tableCell}>Total</td>
                          <td
                            style={{
                              ...styles.tableCell,
                              textAlign: "right",
                              fontWeight: "bold",
                            }}
                          >
                            {femaleComplaintsData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: "#718096",
                      }}
                    >
                      No female complaint data available for this period
                    </div>
                  )}
                </div>
              </div>

              {/* Age Brackets - Male */}
              <div style={styles.card}>
                <div style={styles.sectionTitle}>
                  <User
                    size={20}
                    style={{ marginRight: 12, color: "#2c7a7b" }}
                  />
                  Age Brackets - Male
                </div>
                <div style={{ overflowY: "auto", maxHeight: 384 }}>
                  {maleAgeBracketData.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.tableHeader}>Age Range</th>
                          <th
                            style={{
                              ...styles.tableHeader,
                              textAlign: "right",
                            }}
                          >
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {maleAgeBracketData.map((item, index) => (
                          <tr key={index}>
                            <td style={styles.tableCell}>{item.bracket}</td>
                            <td
                              style={{
                                ...styles.tableCell,
                                textAlign: "right",
                              }}
                            >
                              {item.count}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td style={styles.tableCell}>Total</td>
                          <td
                            style={{
                              ...styles.tableCell,
                              textAlign: "right",
                              fontWeight: "bold",
                            }}
                          >
                            {maleAgeBracketData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: "#718096",
                      }}
                    >
                      No male age data available
                    </div>
                  )}
                </div>
              </div>

              {/* Age Brackets - Female */}
              <div style={styles.card}>
                <div style={styles.sectionTitle}>
                  <UserPlus
                    size={20}
                    style={{ marginRight: 12, color: "#2c7a7b" }}
                  />
                  Age Brackets - Female
                </div>
                <div style={{ overflowY: "auto", maxHeight: 384 }}>
                  {femaleAgeBracketData.length > 0 ? (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.tableHeader}>Age Range</th>
                          <th
                            style={{
                              ...styles.tableHeader,
                              textAlign: "right",
                            }}
                          >
                            Count
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {femaleAgeBracketData.map((item, index) => (
                          <tr key={index}>
                            <td style={styles.tableCell}>{item.bracket}</td>
                            <td
                              style={{
                                ...styles.tableCell,
                                textAlign: "right",
                              }}
                            >
                              {item.count}
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td style={styles.tableCell}>Total</td>
                          <td
                            style={{
                              ...styles.tableCell,
                              textAlign: "right",
                              fontWeight: "bold",
                            }}
                          >
                            {femaleAgeBracketData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: "#718096",
                      }}
                    >
                      No female age data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {!isLoading && !error && (
            <div style={styles.card}>
              <div style={styles.row}>
                <Calendar
                  size={16}
                  style={{ color: "#2c7a7b", marginRight: 8 }}
                />
                <h3
                  style={{ fontSize: 14, fontWeight: "500", color: "#4a5568" }}
                >
                  Report Summary: {monthNames[selectedMonth]} {selectedYear}
                </h3>
              </div>
              <div style={styles.summaryContainer}>
                <div style={styles.summaryBox}>
                  Total Medicines:{" "}
                  {medicineData.reduce((sum, item) => sum + item.count, 0)}
                </div>
                <div style={styles.summaryBox}>
                  Male Complaints:{" "}
                  {maleComplaintsData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}
                </div>
                <div style={styles.summaryBox}>
                  Female Complaints:{" "}
                  {femaleComplaintsData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}
                </div>
                <div style={styles.summaryBox}>
                  Total Male Users:{" "}
                  {maleAgeBracketData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}
                </div>
                <div style={styles.summaryBox}>
                  Total Female Users:{" "}
                  {femaleAgeBracketData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}
                </div>
                <div style={styles.summaryBox}>
                  Total Users:{" "}
                  {maleAgeBracketData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  ) +
                    femaleAgeBracketData.reduce(
                      (sum, item) => sum + item.count,
                      0
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
};

// Add this at the top of your file
const styles = {
  container: {
    padding: "24px",
    textAlign: "center",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
  },
  pageWrapper: {
    backgroundColor: "#f7fafc",
    minHeight: "100vh",
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
  header: {
    background: "linear-gradient(to right, #3182ce, #2b6cb0)",
    color: "white",
    padding: "24px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  headerTitle: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "4px",
  },
  headerSubtitle: {
    fontSize: "14px",
    opacity: 0.9,
  },
  content: {
    padding: "24px",
  },
  card: {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    border: "1px solid #e2e8f0",
    marginBottom: "24px",
  },
  controlsWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  select: {
    padding: "8px",
    border: "1px solid #cbd5e0",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "white",
    color: "black",
  },
  buttonPrimary: {
    backgroundColor: "#3182ce",
    color: "white",
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
  },
  buttonSecondary: {
    backgroundColor: "#ebf8ff",
    color: "#3182ce",
    padding: "8px 16px",
    borderRadius: "6px",
    border: "1px solid #bee3f8",
    cursor: "pointer",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeader: {
    backgroundColor: "#edf2f7",
    textAlign: "left",
    fontWeight: "500",
    color: "#2d3748",
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
  },
  tableCell: {
    padding: "12px",
    color: "#1a202c",
    borderBottom: "1px solid #e2e8f0",
  },
  sectionTitle: {
    fontWeight: "600",
    fontSize: "16px",
    color: "#2d3748",
    display: "flex",
    alignItems: "center",
    marginBottom: "16px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "8px",
  },
  loadingBox: {
    height: "256px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    border: "1px solid #e2e8f0",
  },
  summaryBox: {
    backgroundColor: "#ebf8ff",
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #bee3f8",
    fontSize: "14px",
    color: "#2c5282",
    fontWeight: 500,
  },
  summaryContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "16px",
    marginTop: "12px",
  },
};

export default Reports;
