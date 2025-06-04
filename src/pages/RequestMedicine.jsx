import React, { useEffect, useState, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  setDoc,
} from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import { db } from "../firebase";

// Cache duration in milliseconds (e.g., 1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

const RequestMedicine = () => {
  const [scannedData, setScannedData] = useState("");
  const [isScannedUser, setIsScannedUser] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [medicine, setMedicine] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeIDs, setEmployeeIDs] = useState([]);
  const bufferRef = useRef("");
  const timeoutRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [lastVisitInfo, setLastVisitInfo] = useState(null);
  const [hoveredInput, setHoveredInput] = useState(null);
  const [focusedInput, setFocusedInput] = useState(null);
  const [isThirdParty, setIsThirdParty] = useState(false);

  // User cache for reducing employee ID lookups
  const [userCache, setUserCache] = useState({});

  // Function to get data from cache
  const getFromCache = (key) => {
    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;

    try {
      const { data, timestamp } = JSON.parse(cachedData);
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    } catch (error) {
      console.error("Error parsing cached data:", error);
    }
    return null;
  };

  // Function to save data to cache
  const saveToCache = (key, data) => {
    try {
      const cacheObject = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(cacheObject));
    } catch (error) {
      console.error("Error saving to cache:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Try to get employeeIDs from cache first
      const cachedEmployeeIDs = getFromCache("employeeIDs");
      let employeeIDsData = cachedEmployeeIDs;

      try {
        // Fetch complaints directly from Firestore (no caching)
        const complaintsRef = collection(db, "complaints");
        const complaintsSnapshot = await getDocs(complaintsRef);
        const complaintsData = complaintsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setComplaints(complaintsData);

        // Fetch medicines directly from Firestore (no caching)
        const medicinesRef = collection(db, "medicine");
        const medicinesSnapshot = await getDocs(medicinesRef);
        const medicinesData = medicinesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          };
        });
        setMedicines(medicinesData);

        // Only keep caching for employeeIDs
        if (!employeeIDsData) {
          const usersRef = collection(db, "users");
          const querySnapshot = await getDocs(usersRef);
          employeeIDsData = querySnapshot.docs.map(
            (doc) => doc.data().employeeID
          );
          saveToCache("employeeIDs", employeeIDsData);
        }

        setEmployeeIDs(employeeIDsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Only fallback to cached employeeIDs if available
        if (cachedEmployeeIDs) setEmployeeIDs(cachedEmployeeIDs);
        toast.error("Error fetching data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter medicines when complaint changes
  useEffect(() => {
    if (complaint) {
      const relevantMedicines = medicines.filter((med) => {
        return (
          med.medication &&
          Array.isArray(med.medication) &&
          med.medication.includes(complaint)
        );
      });
      setFilteredMedicines(relevantMedicines);
    } else {
      setFilteredMedicines([]);
    }
    setMedicine("");
  }, [complaint, medicines]);

  // Process scanned data
  const processScannedData = (rawData) => {
    const data = rawData
      // Remove specific key names including 'Control'
      .replace(/Shift|Backspace|Tab|CapsLock|Alt|NumLock|Control/g, "")
      // Remove all non-alphanumeric characters
      .replace(/[^a-zA-Z0-9]/g, "")
      .trim();

    const matchedID = findEmployeeIDInScan(data);

    if (matchedID) {
      return matchedID;
    }
    return data;
  };

  // Find employee ID within scanned data
  const findEmployeeIDInScan = (scanData) => {
    let matches = [];

    // Exact matches
    for (const id of employeeIDs) {
      if (scanData === id) {
        return id;
      }
    }

    // Prefix matches
    for (const id of employeeIDs) {
      const cleanedScan = scanData.replace(/^\d+/, "");
      if (cleanedScan.startsWith(id)) {
        matches.push({ id, score: 90 + id.length });
      }
    }

    // Substring matches
    for (const id of employeeIDs) {
      if (scanData.includes(id)) {
        if (!matches.some((match) => match.id === id)) {
          matches.push({ id, score: 70 + id.length });
        }
      }
    }

    // Pattern matches
    for (const id of employeeIDs) {
      if (id.length > 2) {
        try {
          const idRegex = new RegExp(id.split("").join("\\s*"), "i");
          if (idRegex.test(scanData)) {
            if (!matches.some((match) => match.id === id)) {
              matches.push({ id, score: 50 + id.length });
            }
          }
        } catch (error) {
          console.error("Regex error for ID:", id, error);
        }
      }
    }

    setDebugInfo({
      scanData,
      matches,
    });

    matches.sort((a, b) => b.score - a.score);

    if (matches.length > 0) {
      return matches[0].id;
    }

    return null;
  };

  // Check user cache before fet ching from Firestore
  const fetchUserData = async (employeeID) => {
    setIsSearching(true);

    try {
      // Check if user data is in the in-memory cache
      if (userCache[employeeID]) {
        setUserData(userCache[employeeID]);
        setIsScannedUser(true);
        // Fetch last visit data even for cached users
        await fetchLastVisitInfo(employeeID);
        toast.success("Employee found!");
        setIsSearching(false);
        return;
      }

      // Check if user data is in local storage
      const cachedUser = getFromCache(`user_${employeeID}`);
      if (cachedUser) {
        setUserData(cachedUser);
        // Also update in-memory cache
        setUserCache((prev) => ({ ...prev, [employeeID]: cachedUser }));
        // Fetch last visit data even for cached users
        await fetchLastVisitInfo(employeeID);
        toast.success("Employee found!");
        setIsSearching(false);
        return;
      }

      // If not in cache, first check regular users
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("employeeID", "==", employeeID));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // Update caches
        setUserData({ ...userData, employeeID });
        setIsScannedUser(true);
        setUserCache((prev) => ({ ...prev, [employeeID]: userData }));
        saveToCache(`user_${employeeID}`, userData);
        setIsThirdParty(false); // Not a third-party user

        // Fetch last visit data
        await fetchLastVisitInfo(employeeID);

        toast.success("Employee found!");
      } else {
        // If not found in regular users, check third-party users
        const thirdPartyRef = doc(db, "thirdpartyusers", employeeID);
        const thirdPartyDoc = await getDoc(thirdPartyRef);

        if (thirdPartyDoc.exists()) {
          const thirdPartyData = thirdPartyDoc.data();

          // Update caches
          setUserData({ ...thirdPartyData });
          setIsScannedUser(true);
          setUserCache((prev) => ({ ...prev, [employeeID]: thirdPartyData }));
          saveToCache(`user_${employeeID}`, thirdPartyData);
          setIsThirdParty(true); // Set as third-party user

          // Fetch last visit data
          await fetchLastVisitInfo(employeeID);

          toast.success("Third-party user found!");
        } else {
          setUserData((prev) => ({ ...prev, employeeID }));
          setIsScannedUser(false);
          setIsThirdParty(false);
          toast.error("No user found with this Employee ID");
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast.error("Error fetching user data");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchLastVisitInfo = async (employeeID) => {
    try {
      // Clear previous last visit info
      setLastVisitInfo(null);

      const medicineRequestsRef = collection(db, "medicineRequests");

      // Create query to find the most recent visit
      const q = query(
        medicineRequestsRef,
        where("employeeID", "==", employeeID),
        orderBy("dateVisit", "desc"),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        // Convert timestamp to Date object if it exists and is a timestamp
        let visitDate = null;

        if (data.dateVisit) {
          // Handle both Firestore Timestamp objects and string dates
          if (typeof data.dateVisit.toDate === "function") {
            visitDate = data.dateVisit.toDate();
          } else if (data.dateVisit instanceof Date) {
            visitDate = data.dateVisit;
          } else if (typeof data.dateVisit === "string") {
            visitDate = new Date(data.dateVisit);
          }
        }

        // Set the last visit info with proper date handling
        setLastVisitInfo({
          id: doc.id,
          ...data,
          dateVisit: visitDate || new Date(),
        });

        console.log("Last visit found:", {
          id: doc.id,
          ...data,
          dateVisit: visitDate || new Date(),
        });
      } else {
        console.log("No previous visits found for this employee");
        setLastVisitInfo(null);
      }
    } catch (error) {
      console.error("Error fetching last visit info:", error);
      setLastVisitInfo(null);
    }
  };
  const checkRecentMedicineRequest = async (employeeID, selectedMedicine) => {
    try {
      const medicineRequestsRef = collection(db, "medicineRequests");
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

      // Create query to find medicine requests in the last 4 hours with same medicine
      const q = query(
        medicineRequestsRef,
        where("employeeID", "==", employeeID),
        where("medicine", "==", selectedMedicine),
        where("dateVisit", ">=", fourHoursAgo),
        orderBy("dateVisit", "desc")
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Found recent request with same medicine
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        let requestDate = null;
        if (data.dateVisit) {
          if (typeof data.dateVisit.toDate === "function") {
            requestDate = data.dateVisit.toDate();
          } else if (data.dateVisit instanceof Date) {
            requestDate = data.dateVisit;
          } else if (typeof data.dateVisit === "string") {
            requestDate = new Date(data.dateVisit);
          }
        }

        return {
          recentRequestExists: true,
          requestData: {
            ...data,
            dateVisit: requestDate || new Date(),
          },
        };
      }

      return { recentRequestExists: false };
    } catch (error) {
      console.error("Error checking recent medicine requests:", error);
      return { recentRequestExists: false, error };
    }
  };
  const isMedicineLocked = () => {
    if (!lastVisitInfo || !medicine || lastVisitInfo.medicine !== medicine) {
      return false;
    }

    const hoursSinceLastRequest =
      (new Date() - lastVisitInfo.dateVisit) / (1000 * 60 * 60);
    return hoursSinceLastRequest < 4;
  };

  useEffect(() => {
    if (!formVisible) return;

    const handleKeyDown = (e) => {
      if (isSearching) {
        return;
      }

      if (e.key === "Enter") {
        const processedData = processScannedData(bufferRef.current);
        setScannedData(processedData);
        bufferRef.current = "";

        if (processedData) {
          fetchUserData(processedData);
          setIsScannerActive(true);

          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setIsScannerActive(false);
          }, 5000);
        } else {
          toast.warn("Could not identify a valid Employee ID from scan");
          setIsScannerActive(false);
        }
      } else {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [formVisible, employeeIDs, isSearching]);

  const handleRequestClick = () => {
    setFormVisible(true);
    // Initialize empty user data structure
    setUserData({
      employeeID: "",
      firstname: "",
      lastname: "",
      middleInitial: "",
      gender: "",
      department: "",
    });
    setIsScannedUser(false);
  };

  // Use batch writes to reduce write operations
  const handleSave = async () => {
    if (
      !userData ||
      !userData.employeeID ||
      !userData.firstname ||
      !userData.lastname ||
      !userData.gender ||
      !userData.department ||
      !complaint ||
      !medicine
    ) {
      toast.warn("Please fill all required fields");
      return;
    }

    const quantityDispensed = 1;

    setIsSubmitting(true);
    try {
      if (!window.confirm("Proceed?")) {
        setIsSubmitting(false);
        return;
      }

      // Save third-party user data if checkbox is checked
      if (isThirdParty) {
        try {
          const thirdPartyData = {
            employeeID: userData.employeeID.trim(),
            firstname: userData.firstname || "",
            lastname: userData.lastname || "",
            middleInitial: userData.middleInitial || "",
            gender: userData.gender || "",
            department: userData.department || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          console.log("Saving third party user:", thirdPartyData);

          const thirdPartyDocRef = doc(
            db,
            "thirdpartyusers",
            userData.employeeID.trim()
          );
          await setDoc(thirdPartyDocRef, thirdPartyData, { merge: true });

          setUserCache((prev) => ({
            ...prev,
            [userData.employeeID]: thirdPartyData,
          }));

          saveToCache(`user_${userData.employeeID}`, thirdPartyData);

          toast.success("Third-party user data saved successfully!");
        } catch (error) {
          console.error("Error saving third-party user:", error);
          toast.error(`Error saving third-party user: ${error.message}`);
        }
      }

      const selectedMedicine = filteredMedicines.find(
        (med) => med.name === medicine
      );

      if (selectedMedicine && selectedMedicine.stock < quantityDispensed) {
        toast.error(
          `Sorry, not enough stock! Only ${selectedMedicine.stock} available.`
        );
        setIsSubmitting(false);
        return;
      }

      const employeeID = userData.employeeID;

      const recentRequestCheck = await checkRecentMedicineRequest(
        employeeID,
        medicine
      );
      if (recentRequestCheck.recentRequestExists) {
        const requestTime = recentRequestCheck.requestData.dateVisit;
        const currentTime = new Date();
        const hoursDifference = (currentTime - requestTime) / (1000 * 60 * 60);
        const hoursRemaining = Math.ceil(4 - hoursDifference);

        toast.error(
          `This employee requested the same medicine within the last 4 hours. Please wait ${hoursRemaining} more hour(s) before requesting again.`
        );
        setIsSubmitting(false);
        return;
      }

      // Get the most up-to-date medicine stock
      const medicineDocRef = doc(db, "medicine", selectedMedicine.id);
      const medicineDoc = await getDoc(medicineDocRef);
      const currentMedicineData = medicineDoc.data();

      // Double-check stock levels with fresh data
      if (currentMedicineData.stock < quantityDispensed) {
        toast.error(
          `Sorry, stock level has changed! Only ${currentMedicineData.stock} available now.`
        );

        // Update local cache with current data
        setMedicines((prevMedicines) => {
          const updatedMedicines = [...prevMedicines];
          const index = updatedMedicines.findIndex(
            (m) => m.id === selectedMedicine.id
          );
          if (index !== -1) {
            updatedMedicines[index] = {
              ...updatedMedicines[index],
              ...currentMedicineData,
            };
          }
          return updatedMedicines;
        });

        setIsSubmitting(false);
        return;
      }

      // Start a batch
      const batch = writeBatch(db);

      // Create the request data - same for both regular and third-party
      const requestData = {
        employeeID: employeeID,
        firstname: userData.firstname,
        lastname: userData.lastname,
        middleInitial: userData.middleInitial || "",
        gender: userData.gender,
        department: userData.department,
        complaint: complaint,
        medicine: medicine,
        quantityDispensed: quantityDispensed,
        status: "Completed",
        dateVisit: serverTimestamp(),
      };

      // Add request to the appropriate collection based on third-party status
      if (isThirdParty) {
        // Add to thirdpartyRequests collection
        const thirdPartyRequestRef = collection(db, "thirdpartyRequests");
        const newThirdPartyRequestRef = doc(thirdPartyRequestRef);
        batch.set(newThirdPartyRequestRef, requestData);
        console.log("Saving to thirdpartyRequests collection");
      } else {
        // Add to regular medicineRequests collection
        const medicineRequestRef = collection(db, "medicineRequests");
        const newRequestRef = doc(medicineRequestRef);
        batch.set(newRequestRef, requestData);
        console.log("Saving to medicineRequests collection");
      }

      // Update medicine stock (same for both types of requests)
      const newStock = currentMedicineData.stock - quantityDispensed;
      let newStatus = currentMedicineData.status;

      if (newStock === 0) {
        newStatus = "Out of Stock";
      } else if (newStock <= 20) {
        newStatus = "Low Stock";
      } else {
        newStatus = "In Stock";
      }

      batch.update(medicineDocRef, {
        stock: newStock,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Commit the batch
      await batch.commit();

      // Update local cache
      setMedicines((prevMedicines) => {
        const updatedMedicines = [...prevMedicines];
        const index = updatedMedicines.findIndex(
          (m) => m.id === selectedMedicine.id
        );
        if (index !== -1) {
          updatedMedicines[index] = {
            ...updatedMedicines[index],
            stock: newStock,
            status: newStatus,
          };
        }
        return updatedMedicines;
      });

      toast.success(
        `${
          isThirdParty ? "Third-party" : "Medicine"
        } request submitted successfully!`
      );

      // Refetch last visit info to show the new request
      await fetchLastVisitInfo(scannedData);

      resetUserSelection();

      setIsScannerActive(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsScannerActive(false);
      }, 5000);
    } catch (error) {
      console.error("Error saving request:", error);
      toast.error(
        `Error submitting ${
          isThirdParty ? "third-party" : "medicine"
        } request. Please try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const resetForm = () => {
    setFormVisible(false);
    resetUserSelection();
  };

  const resetUserSelection = () => {
    setUserData(null);
    setScannedData("");
    setIsScannedUser(false);
    setIsThirdParty(false);
    setComplaint("");
    setMedicine("");
    setLastVisitInfo(null);
    bufferRef.current = "";
  };

  // Function to get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "Out of Stock":
        return {
          bg: "#fee2e2",
          text: "#b91c1c",
          border: "#f87171",
        };
      case "Low Stock":
        return {
          bg: "#fef3c7",
          text: "#92400e",
          border: "#fbbf24",
        };
      case "In Stock":
        return {
          bg: "#d1fae5",
          text: "#065f46",
          border: "#34d399",
        };
      default:
        return {
          bg: "#f3f4f6",
          text: "#4b5563",
          border: "#d1d5db",
        };
    }
  };

  const formatDateTime = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return "Unknown date";

    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <Sidebar>
      <ToastContainer position="top-right" autoClose={3000} />
      <div style={styles.container}>
        <div style={styles.dashboardContainer}>
          <div style={styles.dashboardHeader}>
            <h1 style={styles.dashboardTitle}>Clinic Medicine Request</h1>
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

        {!formVisible && (
          <button style={styles.requestButton} onClick={handleRequestClick}>
            Request Medicine
          </button>
        )}

        {formVisible && (
          <>
            <div style={styles.statusContainer}>
              <div
                style={{
                  ...styles.statusCircle,
                  backgroundColor: isSearching
                    ? "#f59e0b" // Amber for searching
                    : isScannerActive
                    ? "#10b981" // Green for active
                    : "#d1d5db", // Gray for inactive
                }}
              />
              <span style={styles.statusText}>
                {isSearching
                  ? "Searching..."
                  : isScannerActive
                  ? "Scanner Active"
                  : "Waiting for scan..."}
              </span>
            </div>

            <div style={styles.resultBox}>
              <h2 style={styles.sectionHeading}>Employee Information</h2>
              {isSearching ? (
                <div style={styles.searchingMessage}>
                  <p>Searching for employee data...</p>
                  <div style={styles.loadingSpinner}></div>
                </div>
              ) : userData ? (
                <>
                  <div style={styles.userInfo}>
                    <div style={styles.infoGrid}>
                      {/* Employee ID */}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Employee ID:</span>
                        <input
                          type="text"
                          value={userData?.employeeID || scannedData}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase();
                            setUserData((prev) => ({
                              ...prev,
                              employeeID: value,
                            }));
                            setScannedData(value);
                          }}
                          style={{
                            ...styles.inputField,
                            ...(hoveredInput === "employeeID"
                              ? styles.inputFieldHover
                              : {}),
                            ...(focusedInput === "employeeID"
                              ? styles.inputFieldFocus
                              : {}),
                          }}
                          onMouseEnter={() => setHoveredInput("employeeID")}
                          onMouseLeave={() => setHoveredInput(null)}
                          onFocus={() => setFocusedInput("employeeID")}
                          onBlur={() => setFocusedInput(null)}
                          disabled={isScannedUser && isSearching}
                        />
                      </div>

                      {/* Gender (No hover logic needed) */}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Gender:</span>
                        <select
                          value={userData?.gender || ""}
                          onChange={(e) => {
                            const value =
                              e.target.value.charAt(0).toUpperCase() +
                              e.target.value.slice(1).toLowerCase();
                            setUserData((prev) => ({ ...prev, gender: value }));
                          }}
                          style={styles.select}
                          disabled={isScannedUser}
                        >
                          <option value="" disabled>
                            Select Gender
                          </option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      {/* Department */}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Department:</span>
                        <input
                          type="text"
                          value={userData?.department || ""}
                          onChange={(e) => {
                            const value = e.target.value
                              .split(" ")
                              .map((word) =>
                                word.toLowerCase() === "and"
                                  ? "and"
                                  : word.charAt(0).toUpperCase() +
                                    word.slice(1).toLowerCase()
                              )
                              .join(" ");
                            setUserData((prev) => ({
                              ...prev,
                              department: value,
                            }));
                          }}
                          style={{
                            ...styles.inputField,
                            ...(hoveredInput === "department"
                              ? styles.inputFieldHover
                              : {}),
                            ...(focusedInput === "department"
                              ? styles.inputFieldFocus
                              : {}),
                          }}
                          onMouseEnter={() => setHoveredInput("department")}
                          onMouseLeave={() => setHoveredInput(null)}
                          onFocus={() => setFocusedInput("department")}
                          onBlur={() => setFocusedInput(null)}
                          disabled={isScannedUser}
                        />
                      </div>

                      {/* First Name */}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>First Name:</span>
                        <input
                          type="text"
                          value={userData?.firstname || ""}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase();
                            setUserData((prev) => ({
                              ...prev,
                              firstname: value,
                            }));
                          }}
                          style={{
                            ...styles.inputField,
                            ...(hoveredInput === "firstname"
                              ? styles.inputFieldHover
                              : {}),
                            ...(focusedInput === "firstname"
                              ? styles.inputFieldFocus
                              : {}),
                          }}
                          onMouseEnter={() => setHoveredInput("firstname")}
                          onMouseLeave={() => setHoveredInput(null)}
                          onFocus={() => setFocusedInput("firstname")}
                          onBlur={() => setFocusedInput(null)}
                          disabled={isScannedUser}
                        />
                      </div>

                      {/* Middle Initial */}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Middle Initial:</span>
                        <input
                          type="text"
                          value={userData?.middleInitial || ""}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase();
                            setUserData((prev) => ({
                              ...prev,
                              middleInitial: value,
                            }));
                          }}
                          style={{
                            ...styles.inputField,
                            ...(hoveredInput === "middleInitial"
                              ? styles.inputFieldHover
                              : {}),
                            ...(focusedInput === "middleInitial"
                              ? styles.inputFieldFocus
                              : {}),
                          }}
                          onMouseEnter={() => setHoveredInput("middleInitial")}
                          onMouseLeave={() => setHoveredInput(null)}
                          onFocus={() => setFocusedInput("middleInitial")}
                          onBlur={() => setFocusedInput(null)}
                          maxLength={1}
                          disabled={isScannedUser}
                        />
                      </div>

                      {/* Last Name */}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Last Name:</span>
                        <input
                          type="text"
                          value={userData?.lastname || ""}
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase();
                            setUserData((prev) => ({
                              ...prev,
                              lastname: value,
                            }));
                          }}
                          style={{
                            ...styles.inputField,
                            ...(hoveredInput === "lastname"
                              ? styles.inputFieldHover
                              : {}),
                            ...(focusedInput === "lastname"
                              ? styles.inputFieldFocus
                              : {}),
                          }}
                          onMouseEnter={() => setHoveredInput("lastname")}
                          onMouseLeave={() => setHoveredInput(null)}
                          onFocus={() => setFocusedInput("lastname")}
                          onBlur={() => setFocusedInput(null)}
                          disabled={isScannedUser}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={styles.thirdPartyCheckbox}>
                    <input
                      type="checkbox"
                      id="thirdPartyCheck"
                      checked={isThirdParty}
                      onChange={(e) => setIsThirdParty(e.target.checked)}
                      style={styles.checkbox}
                    />
                    <label
                      htmlFor="thirdPartyCheck"
                      style={styles.checkboxLabel}
                    >
                      Third-Party User
                    </label>
                  </div>

                  {/* Last Visit Information Section */}
                  <div style={styles.lastVisitSection}>
                    <h3 style={styles.subsectionHeading}>
                      Last Visit Information
                    </h3>
                    {lastVisitInfo ? (
                      <div style={styles.lastVisitInfo}>
                        <div style={styles.infoGrid}>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Date:</span>
                            <span style={styles.infoValue}>
                              {formatDateTime(lastVisitInfo.dateVisit)}
                            </span>
                          </div>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Complaint:</span>
                            <span style={styles.infoValue}>
                              {lastVisitInfo.complaint}
                            </span>
                          </div>
                          <div style={styles.infoItem}>
                            <span style={styles.infoLabel}>Medicine:</span>
                            <span style={styles.infoValue}>
                              {lastVisitInfo.medicine}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.noVisitInfo}>
                        <p>No previous visits found</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={styles.scanPrompt}>
                  <p>Scan employee ID to fetch data</p>
                  <div style={styles.scanIcon}>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2m12-16h-2a1 1 0 00-1 1v2m0 12v2a1 1 0 001 1h2M7 12h10"
                        stroke="#1e3a8a"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {userData && !isSearching && (
                <>
                  <div style={styles.formSection}>
                    <h2 style={styles.sectionHeading}>Request Details</h2>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Complaint:
                        <select
                          value={complaint}
                          onChange={(e) => setComplaint(e.target.value)}
                          style={styles.select}
                          disabled={isLoading}
                        >
                          <option value="" disabled hidden>
                            Select Complaint
                          </option>
                          {complaints.map((item) => (
                            <option key={item.id} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Medicine:
                        <select
                          value={medicine}
                          onChange={(e) => setMedicine(e.target.value)}
                          style={{
                            ...styles.select,
                            opacity: !complaint || isLoading ? 0.6 : 1,
                          }}
                          disabled={!complaint || isLoading}
                        >
                          <option value="" disabled hidden>
                            Select Medicine
                          </option>
                          {filteredMedicines.map((item) => (
                            <option key={item.id} value={item.name}>
                              {item.name} - Stock: {item.stock}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {medicine && (
                      <div style={styles.medicineInfo}>
                        <h3 style={styles.medicineInfoHeading}>
                          Medicine Information
                        </h3>
                        {filteredMedicines
                          .filter((med) => med.name === medicine)
                          .map((med) => {
                            const statusColors = getStatusColor(med.status);
                            return (
                              <div key={med.id}>
                                <div style={styles.medicineInfoGrid}>
                                  <div style={styles.medicineInfoItem}>
                                    <span style={styles.medicineInfoLabel}>
                                      Stock:
                                    </span>
                                    <span style={styles.medicineInfoValue}>
                                      {med.stock}
                                    </span>
                                  </div>
                                  <div style={styles.medicineInfoItem}>
                                    <span style={styles.medicineInfoLabel}>
                                      Status:
                                    </span>
                                    <div
                                      style={{
                                        ...styles.statusBadge,
                                        backgroundColor: statusColors.bg,
                                        color: statusColors.text,
                                        borderColor: statusColors.border,
                                      }}
                                    >
                                      {med.status}
                                    </div>
                                  </div>
                                </div>

                                {med.stock === 0 && (
                                  <div style={styles.outOfStockWarning}>
                                    <span style={styles.warningIcon}>⚠️</span>
                                    <span>This medicine is out of stock!</span>
                                  </div>
                                )}

                                {med.stock > 0 && med.stock <= 10 && (
                                  <div style={styles.lowStockWarning}>
                                    <span style={styles.warningIcon}>⚠️</span>
                                    <span>
                                      Low stock warning! Only {med.stock}{" "}
                                      remaining.
                                    </span>
                                  </div>
                                )}

                                {/* Add the lock period warning here, after the other warnings */}
                                {lastVisitInfo &&
                                  lastVisitInfo.medicine === medicine &&
                                  (new Date() - lastVisitInfo.dateVisit) /
                                    (1000 * 60 * 60) <
                                    4 && (
                                    <div style={styles.lockWarning}>
                                      <span style={styles.warningIcon}>🔒</span>
                                      <span>
                                        This medicine was already dispensed
                                        within the last 4 hours.{" "}
                                        {Math.ceil(
                                          4 -
                                            (new Date() -
                                              lastVisitInfo.dateVisit) /
                                              (1000 * 60 * 60)
                                        )}{" "}
                                        hour(s) remaining before it can be
                                        requested again.
                                      </span>
                                    </div>
                                  )}

                                {med.stock > 0 && (
                                  <div style={styles.quantityNote}>
                                    <span style={styles.infoIcon}>ℹ️</span>
                                    <span>
                                      Only 1 quantity will be dispensed per
                                      request
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <div style={styles.actionButtons}>
                    <button
                      style={{
                        ...styles.saveButton,
                        opacity:
                          !userData ||
                          !complaint ||
                          !medicine ||
                          isSubmitting ||
                          filteredMedicines.find((med) => med.name === medicine)
                            ?.stock === 0 ||
                          isMedicineLocked()
                            ? 0.6
                            : 1,
                      }}
                      onClick={handleSave}
                      disabled={
                        !userData ||
                        !complaint ||
                        !medicine ||
                        isSubmitting ||
                        filteredMedicines.find((med) => med.name === medicine)
                          ?.stock === 0 ||
                        isMedicineLocked()
                      }
                    >
                      {isSubmitting ? (
                        <div style={styles.buttonSpinner}></div>
                      ) : (
                        "Save Request"
                      )}
                    </button>
                    <button style={styles.cancelButton} onClick={handleCancel}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Sidebar>
  );
};

const styles = {
  container: {
    padding: "32px",
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
  requestButton: {
    padding: "12px 28px",
    backgroundColor: "#1e3a8a",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "500",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    transition: "all 0.2s ease",
    display: "block",
    margin: "0 auto",
  },
  statusContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "24px",
    backgroundColor: "#f8fafc",
    padding: "12px",
    borderRadius: "8px",
    width: "fit-content",
    margin: "0 auto 24px auto",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
  },
  statusCircle: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    transition: "background-color 0.3s ease",
  },
  statusText: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#4b5563",
  },
  resultBox: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
    margin: "0 auto",
    color: "#1f2937",
  },
  sectionHeading: {
    color: "#1e3a8a",
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "1px solid #e5e7eb",
  },
  inputField: {
    width: "93.5%",
    padding: "12px 14px",
    fontSize: "15px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#111827",
    transition: "all 0.3s ease",
    marginTop: "4px",
    outline: "none",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    fontFamily: "'Inter', sans-serif",
  },
  inputFieldHover: {
    borderColor: "#3b82f6",
    backgroundColor: "#f3f4f6",
    cursor: "text",
  },

  inputFieldFocus: {
    borderColor: "#2563eb",
    boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.25)",
    backgroundColor: "#ffffff",
  },

  select: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    color: "#111827",
    transition: "border-color 0.3s ease",
    marginTop: "4px",
    outline: "none",
    fontFamily: "'Inter', sans-serif",
  },
  userInfo: {
    marginBottom: "32px",
    padding: "24px",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
    fontFamily: "'Inter', sans-serif",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "16px",
  },
  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  infoLabel: {
    fontSize: "14px",
    color: "#6b7280",
    fontWeight: "500",
    marginBottom: "4px",
  },
  infoValue: {
    fontSize: "16px",
    color: "#111827",
    fontWeight: "500",
  },
  scanPrompt: {
    textAlign: "center",
    padding: "32px 0",
    color: "#6b7280",
  },
  scanIcon: {
    margin: "16px auto",
    opacity: 0.7,
  },
  formSection: {
    marginTop: "24px",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#4b5563",
  },
  medicineInfo: {
    backgroundColor: "#f0f7ff",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
    marginBottom: "24px",
    border: "1px solid #bfdbfe",
  },
  medicineInfoHeading: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#1e3a8a",
    marginBottom: "12px",
  },
  medicineInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  medicineInfoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  medicineInfoLabel: {
    fontSize: "14px",
    color: "#4b5563",
  },
  medicineInfoValue: {
    fontSize: "16px",
    fontWeight: "500",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "14px",
    fontWeight: "500",
    whiteSpace: "nowrap",
    border: "1px solid transparent",
    marginTop: "4px",
  },
  lowStockWarning: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: "8px 12px",
    borderRadius: "6px",
    marginTop: "12px",
    fontSize: "14px",
    border: "1px solid #fbbf24",
  },
  outOfStockWarning: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    padding: "8px 12px",
    borderRadius: "6px",
    marginTop: "12px",
    fontSize: "14px",
    border: "1px solid #f87171",
  },
  warningIcon: {
    fontSize: "16px",
  },
  quantityContainer: {
    marginTop: "16px",
    backgroundColor: "#f9fafb",
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
  },
  quantityLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#4b5563",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  quantityControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  quantityInput: {
    width: "60px",
    padding: "8px",
    textAlign: "center",
    borderRadius: "4px",
    border: "1px solid #d1d5db",
    fontSize: "16px",
  },
  quantityButton: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    border: "1px solid #d1d5db",
    backgroundColor: "#f9fafb",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtons: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "24px",
  },
  saveButton: {
    padding: "10px 0",
    backgroundColor: "#1e3a8a",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    flex: "1",
    fontSize: "16px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.2s ease",
  },
  cancelButton: {
    padding: "10px 0",
    backgroundColor: "#f3f4f6",
    color: "#4b5563",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    cursor: "pointer",
    flex: "1",
    fontSize: "16px",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
  searchingMessage: {
    textAlign: "center",
    padding: "24px 0",
    color: "#6b7280",
  },
  loadingSpinner: {
    borderTop: "3px solid #1e3a8a",
    borderRight: "3px solid transparent",
    borderRadius: "50%",
    width: "24px",
    height: "24px",
    animation: "spin 1s linear infinite",
    margin: "16px auto",
  },
  buttonSpinner: {
    borderTop: "2px solid #ffffff",
    borderRight: "2px solid transparent",
    borderRadius: "50%",
    width: "18px",
    height: "18px",
    animation: "spin 1s linear infinite",
  },
  lastVisitSection: {
    marginTop: "1rem",
    backgroundColor: "#f8f9fa",
    padding: "1rem",
    borderRadius: "0.5rem",
    borderLeft: "4px solid #3b82f6",
  },
  subsectionHeading: {
    fontSize: "1.1rem",
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: "0.75rem",
  },
  lastVisitInfo: {
    backgroundColor: "#ffffff",
    padding: "0.75rem",
    borderRadius: "0.375rem",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  noVisitInfo: {
    padding: "0.75rem",
    color: "#6b7280",
    fontStyle: "italic",
  },
  lockWarning: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    padding: "8px 12px",
    borderRadius: "4px",
    marginTop: "12px",
    display: "flex",
    alignItems: "center",
    fontSize: "14px",
  },
  thirdPartyCheckbox: {
    marginTop: "15px",
    marginBottom: "10px",
    display: "flex",
    alignItems: "center",
  },
  checkbox: {
    marginRight: "8px",
    width: "16px",
    height: "16px",
    cursor: "pointer",
  },
  checkboxLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#4b5563",
    cursor: "pointer",
  },
  "@keyframes spin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },
};

export default RequestMedicine;
