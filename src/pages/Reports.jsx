import { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  FileText,
  RefreshCw,
  User,
  UserPlus,
  Clock,
  Printer,
} from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import logo from "../assets/innodatalogo.png"; // Add this import for your logo

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
  const [isPrintHovered, setIsPrintHovered] = useState(false);

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
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header with month and year
    csvContent += `Medical Reports for the Month of ${monthNames[selectedMonth]} ${selectedYear}\r\n`;
    csvContent += `Generated on: ${new Date().toLocaleDateString()}\r\n\r\n`;

    // Medicine data section
    csvContent += "MEDICINE DISTRIBUTION\r\n";
    csvContent += "Medicine Name,Count\r\n";
    medicineData.forEach((item) => {
      csvContent += `${item.medicineName},${item.count}\r\n`;
    });
    csvContent += `Total Medicines Distributed,${medicineData.reduce(
      (sum, item) => sum + item.count,
      0
    )}\r\n\r\n`;

    // Complaints section - Side by side layout
    csvContent += "HEALTH COMPLAINTS BY GENDER\r\n";
    csvContent += "Male Complaints,Count,Female Complaints,Count\r\n";
    
    // Get the maximum length to handle uneven arrays
    const maxComplaintLength = Math.max(maleComplaintsData.length, femaleComplaintsData.length);
    
    for (let i = 0; i < maxComplaintLength; i++) {
      const maleComplaint = maleComplaintsData[i] || { complaint: '', count: '' };
      const femaleComplaint = femaleComplaintsData[i] || { complaint: '', count: '' };
      csvContent += `${maleComplaint.complaint},${maleComplaint.count},${femaleComplaint.complaint},${femaleComplaint.count}\r\n`;
    }
    
    // Totals for complaints
    const maleComplaintsTotal = maleComplaintsData.reduce((sum, item) => sum + item.count, 0);
    const femaleComplaintsTotal = femaleComplaintsData.reduce((sum, item) => sum + item.count, 0);
    csvContent += `Total Male Complaints,${maleComplaintsTotal},Total Female Complaints,${femaleComplaintsTotal}\r\n\r\n`;

    // Age brackets section - Side by side layout
    csvContent += "AGE DISTRIBUTION BY GENDER\r\n";
    csvContent += "Male Age Range,Count,Female Age Range,Count\r\n";
    
    // Get the maximum length to handle uneven arrays
    const maxAgeLength = Math.max(maleAgeBracketData.length, femaleAgeBracketData.length);
    
    for (let i = 0; i < maxAgeLength; i++) {
      const maleAge = maleAgeBracketData[i] || { bracket: '', count: '' };
      const femaleAge = femaleAgeBracketData[i] || { bracket: '', count: '' };
      csvContent += `${maleAge.bracket},${maleAge.count},${femaleAge.bracket},${femaleAge.count}\r\n`;
    }
    
    // Totals for age brackets
    const maleTotal = maleAgeBracketData.reduce((sum, item) => sum + item.count, 0);
    const femaleTotal = femaleAgeBracketData.reduce((sum, item) => sum + item.count, 0);
    csvContent += `Total Males,${maleTotal},Total Females,${femaleTotal}\r\n\r\n`;

    // Summary section
    csvContent += "SUMMARY\r\n";
    csvContent += "Category,Count\r\n";
    csvContent += `Total Male Patients,${maleTotal}\r\n`;
    csvContent += `Total Female Patients,${femaleTotal}\r\n`;
    csvContent += `Total Patients,${maleTotal + femaleTotal}\r\n`;
    csvContent += `Total Medicines Distributed,${medicineData.reduce((sum, item) => sum + item.count, 0)}\r\n`;
    csvContent += `Total Health Complaints,${maleComplaintsTotal + femaleComplaintsTotal}\r\n`;

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

  // Function to handle printing
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

      // Calculate totals
      const totalMedicines = medicineData.reduce((sum, item) => sum + item.count, 0);
      const totalMaleComplaints = maleComplaintsData.reduce((sum, item) => sum + item.count, 0);
      const totalFemaleComplaints = femaleComplaintsData.reduce((sum, item) => sum + item.count, 0);
      const totalMales = maleAgeBracketData.reduce((sum, item) => sum + item.count, 0);
      const totalFemales = femaleAgeBracketData.reduce((sum, item) => sum + item.count, 0);

      // Create title based on selected filters
      const reportTitle = `Medical Reports - ${monthNames[selectedMonth]} ${selectedYear}`;

      // Create a comprehensive HTML content for the print window
      const printContent = `
        <html>
          <head>
            <title>Print Medical Reports</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0;
                padding: 20px;
                font-size: 12px;
              }
              .header { 
                display: flex; 
                align-items: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #3182ce;
                padding-bottom: 15px;
              }
              .logo { 
                height: 60px; 
                margin-right: 20px; 
              }
              .header-text { 
                flex: 1; 
              }
              .header-text h1 {
                color: #3182ce;
                margin: 0;
                font-size: 24px;
              }
              .print-date { 
                font-size: 12px; 
                color: #666; 
                margin-top: 5px; 
              }
              .section {
                margin-bottom: 30px;
                break-inside: avoid;
              }
              .section-title {
                background-color: #3182ce;
                color: white;
                padding: 8px 12px;
                margin-bottom: 10px;
                font-weight: bold;
                font-size: 14px;
              }
              .two-column {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
              }
              .three-column {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 15px;
              }
              th, td { 
                border: 1px solid #ddd; 
                padding: 6px 8px; 
                text-align: left; 
                font-size: 11px;
              }
              th { 
                background-color: #f8f9fa; 
                font-weight: bold;
              }
              .total-row {
                background-color: #e8f4f8;
                font-weight: bold;
              }
              .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-top: 20px;
              }
              .summary-card {
                background-color: #f8f9fa;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                text-align: center;
              }
              .summary-card .number {
                font-size: 18px;
                font-weight: bold;
                color: #3182ce;
                display: block;
              }
              .summary-card .label {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
              }
              @media print {
                .section {
                  break-inside: avoid;
                }
                .header {
                  break-after: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoBase64}" alt="Innodata Logo" class="logo">
              <div class="header-text">
                <h1>${reportTitle}</h1>
                <p class="print-date">Generated on: ${new Date().toLocaleDateString(
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

            <!-- Summary Cards -->
            <div class="section">
              <div class="section-title">Executive Summary</div>
              <div class="summary-grid">
                <div class="summary-card">
                  <span class="number">${totalMedicines}</span>
                  <div class="label">Total Medicines Distributed</div>
                </div>
                <div class="summary-card">
                  <span class="number">${totalMales + totalFemales}</span>
                  <div class="label">Total Employees</div>
                </div>
                <div class="summary-card">
                  <span class="number">${totalMaleComplaints + totalFemaleComplaints}</span>
                  <div class="label">Total Health Complaints</div>
                </div>
                <div class="summary-card">
                  <span class="number">${totalMales}</span>
                  <div class="label">Male Employees</div>
                </div>
                <div class="summary-card">
                  <span class="number">${totalFemales}</span>
                  <div class="label">Female Employees</div>
                </div>
                <div class="summary-card">
                  <span class="number">${monthNames[selectedMonth]}</span>
                  <div class="label">Report Period</div>
                </div>
              </div>
            </div>

            <!-- Medicine Distribution -->
            <div class="section">
              <div class="section-title">Medicine Distribution</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 70%">Medicine Name</th>
                    <th style="width: 30%; text-align: right;">Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${medicineData.map(item => `
                    <tr>
                      <td>${item.medicineName}</td>
                      <td style="text-align: right;">${item.count}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td>Total</td>
                    <td style="text-align: right;">${totalMedicines}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Health Complaints by Gender -->
            <div class="section">
              <div class="section-title">Health Complaints by Gender</div>
              <div class="two-column">
                <div>
                  <h4 style="margin-top: 0; color: #3182ce;">Male Complaints</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Complaint</th>
                        <th style="text-align: right;">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${maleComplaintsData.map(item => `
                        <tr>
                          <td>${item.complaint}</td>
                          <td style="text-align: right;">${item.count}</td>
                        </tr>
                      `).join('')}
                      <tr class="total-row">
                        <td>Total</td>
                        <td style="text-align: right;">${totalMaleComplaints}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 style="margin-top: 0; color: #3182ce;">Female Complaints</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Complaint</th>
                        <th style="text-align: right;">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${femaleComplaintsData.map(item => `
                        <tr>
                          <td>${item.complaint}</td>
                          <td style="text-align: right;">${item.count}</td>
                        </tr>
                      `).join('')}
                      <tr class="total-row">
                        <td>Total</td>
                        <td style="text-align: right;">${totalFemaleComplaints}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Age Distribution -->
            <div class="section">
              <div class="section-title">Age Distribution by Gender</div>
              <div class="two-column">
                <div>
                  <h4 style="margin-top: 0; color: #3182ce;">Male Age Brackets</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Age Range</th>
                        <th style="text-align: right;">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${maleAgeBracketData.map(item => `
                        <tr>
                          <td>${item.bracket}</td>
                          <td style="text-align: right;">${item.count}</td>
                        </tr>
                      `).join('')}
                      <tr class="total-row">
                        <td>Total</td>
                        <td style="text-align: right;">${totalMales}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 style="margin-top: 0; color: #3182ce;">Female Age Brackets</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Age Range</th>
                        <th style="text-align: right;">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${femaleAgeBracketData.map(item => `
                        <tr>
                          <td>${item.bracket}</td>
                          <td style="text-align: right;">${item.count}</td>
                        </tr>
                      `).join('')}
                      <tr class="total-row">
                        <td>Total</td>
                        <td style="text-align: right;">${totalFemales}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
      // Fallback to printing without logo - you can implement this if needed
      alert("Error loading logo. Please try again.");
    };
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
                  onClick={handlePrint}
                  style={
                    isPrintHovered
                      ? { ...styles.buttonPrimary, backgroundColor: "#2563eb" }
                      : styles.buttonPrimary
                  }
                  onMouseEnter={() => setIsPrintHovered(true)}
                  onMouseLeave={() => setIsPrintHovered(false)}
                  aria-label="Print reports"
                >
                  <Printer size={16} style={{ marginRight: 8 }} />
                  <span>Print Reports</span>
                </button>

                <button
                  onClick={exportData}
                  style={styles.buttonSecondary}
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
                  Total Male Employees:{" "}
                  {maleAgeBracketData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}
                </div>
                <div style={styles.summaryBox}>
                  Total Female Employees:{" "}
                  {femaleAgeBracketData.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}
                </div>
                <div style={styles.summaryBox}>
                  Total Employees:{" "}
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
