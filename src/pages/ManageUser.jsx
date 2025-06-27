import React, { useEffect, useState, useMemo, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { app } from "../firebase";
import {
  FiPlus,
  FiEdit,
  FiTrash,
  FiUserX,
  FiUpload,
  FiTrash2,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";
import { FaUserCheck } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/ManageUser.css";
import * as XLSX from "xlsx";

// Cache key for localStorage
const USERS_CACHE_KEY = "manage_users_cache";
const CACHE_EXPIRY_KEY = "manage_users_cache_expiry";
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const ManageUser = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredUser, setHoveredUser] = useState(null);
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [userForm, setUserForm] = useState({
    firstname: "",
    middleInitial: "",
    lastname: "",
    role: "",
    department: "",
    designation: "",
    gender: "",
    employeeID: "",
    dob: "",
  });
  const [formErrors, setFormErrors] = useState({
    firstname: "",
    middleInitial: "",
    lastname: "",
    role: "",
    department: "",
    designation: "",
    gender: "",
    employeeID: "",
    dob: "",
  });

  // Helper function to check if cache is expired
  const isCacheExpired = useCallback(() => {
    const expiryTime = localStorage.getItem(CACHE_EXPIRY_KEY);
    return !expiryTime || Date.now() > parseInt(expiryTime);
  }, []);

  // Helper function to save data to cache
  const saveToCache = useCallback((data) => {
    try {
      // Process Timestamp objects before saving to localStorage
      const processedData = data.map((user) => ({
        ...user,
        // Convert Firestore Timestamp to serializable format
        dob: user.dob
          ? {
              seconds: user.dob.seconds,
              nanoseconds: user.dob.nanoseconds,
            }
          : null,
        createdAt: user.createdAt
          ? {
              seconds: user.createdAt.seconds,
              nanoseconds: user.createdAt.nanoseconds,
            }
          : null,
      }));

      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(processedData));
      localStorage.setItem(
        CACHE_EXPIRY_KEY,
        (Date.now() + CACHE_EXPIRY_TIME).toString()
      );
      setLastFetchTime(new Date());
    } catch (error) {
      console.error("Error saving to cache:", error);
      // If local storage fails (e.g., quota exceeded), attempt to clear it and try again
      try {
        localStorage.removeItem(USERS_CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(
          CACHE_EXPIRY_KEY,
          (Date.now() + CACHE_EXPIRY_TIME).toString()
        );
      } catch (retryError) {
        console.error("Failed to save to cache even after retry:", retryError);
        toast.warning(
          "Failed to cache user data locally. Some features may be slower."
        );
      }
    }
  }, []);

  // Helper function to load data from cache
  const loadFromCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem(USERS_CACHE_KEY);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);

        // Convert serialized timestamps back to Firestore Timestamp objects
        const processedData = parsedData.map((user) => ({
          ...user,
          // Convert serialized timestamp back to a Firestore Timestamp-like object with toDate method
          dob: user.dob
            ? {
                ...user.dob,
                toDate: () => new Date(user.dob.seconds * 1000),
              }
            : null,
          createdAt: user.createdAt
            ? {
                ...user.createdAt,
                toDate: () => new Date(user.createdAt.seconds * 1000),
              }
            : null,
        }));

        return processedData;
      }
      return null;
    } catch (error) {
      console.error("Error loading from cache:", error);
      return null;
    }
  }, []);

  // Function to fetch users from Firestore
  const fetchUsersFromFirestore = useCallback(
    async (force = false) => {
      try {
        setLoading(true);

        // Check if we can use cached data
        if (!force && !isCacheExpired()) {
          const cachedUsers = loadFromCache();
          if (cachedUsers && cachedUsers.length > 0) {
            setUsers(cachedUsers);
            setLoading(false);
            const cacheTime = new Date(
              parseInt(localStorage.getItem(CACHE_EXPIRY_KEY)) -
                CACHE_EXPIRY_TIME
            );
            setLastFetchTime(cacheTime);
            return;
          }
        }

        // Fetch from Firestore if cache is expired or forced refresh
        const db = getFirestore(app);
        const usersCollection = collection(db, "users");
        const snapshot = await getDocs(usersCollection);
        const usersList = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => a.lastname?.localeCompare(b.lastname));

        setUsers(usersList);
        saveToCache(usersList);
        setLastFetchTime(new Date());
      } catch (error) {
        console.error("Failed to fetch users:", error);
        toast.error("Failed to fetch users data");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [saveToCache, loadFromCache, isCacheExpired]
  );

  // Initial data load
  useEffect(() => {
    fetchUsersFromFirestore();
  }, [fetchUsersFromFirestore]);

  // Force refresh data from Firestore
  const handleRefreshData = () => {
    setIsRefreshing(true);
    fetchUsersFromFirestore(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];

          const users = [];
          let rowIndex = 2;
          let rowCount = 0;

          while (true) {
            const employeeIDCell = worksheet[`B${rowIndex}`];

            // Break if no employee ID is found (end of data)
            if (!employeeIDCell || !employeeIDCell.v) break;

            const employeeID = String(employeeIDCell.v).trim();
            const nameCell = worksheet[`C${rowIndex}`];
            const dobCell = worksheet[`D${rowIndex}`];
            const genderCell = worksheet[`E${rowIndex}`];
            const designationCell = worksheet[`M${rowIndex}`];
            const departmentCell = worksheet[`N${rowIndex}`];

            let firstname = "";
            let middleInitial = "";
            let lastname = "";

            if (nameCell && nameCell.v) {
              const fullName = String(nameCell.v).trim();

              if (fullName.includes(",")) {
                const [lastPart, firstPart] = fullName
                  .split(",")
                  .map((part) => part.trim());

                lastname = lastPart;

                const firstNameParts = firstPart.split(" ");

                if (firstNameParts.length >= 1) {
                  firstname = firstNameParts[0];

                  const lastPartIndex = firstNameParts.length - 1;
                  const potentialMiddleInitial = firstNameParts[lastPartIndex];

                  if (
                    potentialMiddleInitial &&
                    potentialMiddleInitial.endsWith(".")
                  ) {
                    middleInitial = potentialMiddleInitial.replace(".", "");

                    if (firstNameParts.length > 1) {
                      firstname = firstNameParts
                        .slice(0, lastPartIndex)
                        .join(" ");
                    }
                  } else if (firstNameParts.length > 1) {
                    firstname = firstNameParts[0];
                    middleInitial = firstNameParts[1].charAt(0);
                  }
                }
              } else {
                lastname = fullName;
              }
            }

            let dob = null;
            if (dobCell && dobCell.v) {
              if (typeof dobCell.v === "number") {
                dob = new Date(Math.round((dobCell.v - 25569) * 86400 * 1000));
              } else {
                const dobString = String(dobCell.v).trim();
                const dobParts = dobString.split("/");

                if (dobParts.length === 3) {
                  const month = parseInt(dobParts[0], 10) - 1;
                  const day = parseInt(dobParts[1], 10);
                  const year = parseInt(dobParts[2], 10);

                  dob = new Date(year, month, day);

                  if (isNaN(dob.getTime())) {
                    dob = null;
                  }
                }
              }
            }

            let gender = "";
            if (genderCell && genderCell.v) {
              const genderValue = String(genderCell.v).trim().toLowerCase();
              gender =
                genderValue.charAt(0).toUpperCase() + genderValue.slice(1);

              if (gender !== "Male" && gender !== "Female") {
                if (
                  gender.startsWith("M") ||
                  gender === "M" ||
                  gender === "m"
                ) {
                  gender = "Male";
                } else if (
                  gender.startsWith("F") ||
                  gender === "F" ||
                  gender === "f"
                ) {
                  gender = "Female";
                }
              }
            }

            let designation = "";
            if (designationCell && designationCell.v) {
              designation = String(designationCell.v).trim().toUpperCase();
            }

            let department = "";
            if (departmentCell && departmentCell.v) {
              department = String(departmentCell.v).trim();
              department = capitalizeWords(department);
            }

            users.push({
              employeeID,
              firstname: firstname.toUpperCase(),
              middleInitial: middleInitial.toUpperCase(),
              lastname: lastname.toUpperCase(),
              dob,
              gender,
              designation,
              department,
            });

            rowIndex++;
            rowCount++;
          }

          if (users.length === 0) {
            toast.error("No employee data found in the Excel file");
            setIsUploading(false);
            return;
          }

          await saveEmployeesToFirestore(users);
        } catch (error) {
          console.error("Error processing Excel file:", error);
          toast.error("Failed to process Excel file");
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read the file");
        setIsUploading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("File upload failed");
      setIsUploading(false);
    }

    e.target.value = null;
  };

  const saveEmployeesToFirestore = async (users) => {
    const db = getFirestore(app);
    let successCount = 0;
    let errorCount = 0;
    let removedCount = 0;

    try {
      // Create a set of employeeIDs from the Excel file for quick lookup
      const importedEmployeeIDs = new Set(
        users.map((user) => user.employeeID.toUpperCase())
      );

      const existingUsersSnapshot = await getDocs(collection(db, "users"));
      const existingUsers = existingUsersSnapshot.docs.map((doc) => ({
        id: doc.id,
        employeeID: doc.data().employeeID,
        role: doc.data().role,
      }));

      // Filter users to delete: not in imported list AND not an Admin
      const usersToDelete = existingUsers.filter(
        (user) =>
          !importedEmployeeIDs.has(user.employeeID?.toUpperCase()) &&
          user.role !== "Admin"
      );

      // Update in-memory state to track what's being deleted
      const currentUserIds = new Set(existingUsers.map((user) => user.id));

      for (const user of usersToDelete) {
        try {
          await deleteDoc(doc(db, "users", user.id));
          removedCount++;
        } catch (error) {
          console.error(`Error removing employee ${user.id}:`, error);
          errorCount++;
        }
      }

      let batch = writeBatch(db);
      let batchCount = 0;
      let updatedUsers = [...users]; // Create a new array for tracking updates

      for (const user of users) {
        try {
          const userRef = doc(db, "users", user.employeeID);

          // Check if this is an existing user who might be an Admin
          const existingUser = existingUsers.find(
            (eu) =>
              eu.employeeID?.toUpperCase() === user.employeeID?.toUpperCase()
          );

          // If user exists and is an Admin, preserve Admin role
          const role =
            existingUser && existingUser.role === "Admin"
              ? "Admin"
              : "Employee";

          const userData = {
            employeeID: user.employeeID,
            firstname: user.firstname,
            middleInitial: user.middleInitial,
            lastname: user.lastname,
            designation: user.designation,
            department: user.department,
            role: role, // Use preserved role or default to Employee
            gender: user.gender,
            dob: user.dob ? Timestamp.fromDate(user.dob) : null,
            createdAt: serverTimestamp(),
            status: "Active",
          };

          batch.set(userRef, userData);
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            successCount += batchCount;
            batch = writeBatch(db);
            batchCount = 0;
          }
        } catch (err) {
          console.error(`Error adding employee ${user.employeeID}:`, err);
          errorCount++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        successCount += batchCount;
      }

      // Update the in-memory cache
      const snapshot = await getDocs(collection(db, "users"));
      const updatedUsersList = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => a.lastname?.localeCompare(b.lastname));

      setUsers(updatedUsersList);
      saveToCache(updatedUsersList); // Update the local storage cache too

      if (errorCount === 0) {
        toast.success(
          `Successfully processed ${successCount} employees and removed ${removedCount} employees not in the uploaded file (Admin users preserved).`
        );
      } else {
        toast.warning(
          `Added ${successCount} employees, removed ${removedCount} employees (Admin users preserved), with ${errorCount} errors`
        );
      }
    } catch (error) {
      console.error("Failed to save employee data:", error);
      toast.error("Failed to save employee data to database");
    }
  };

  const filterUsers = (user) => {
    if (!search || search.trim() === "") return true;

    const searchLower = search.toLowerCase();

    // Handle special case for gender
    if (searchLower === "male" || searchLower === "female") {
      return (user.gender || "").toLowerCase() === searchLower;
    }

    // Handle name concatenation safely
    const fullName = `${user.firstname || ""} ${
      user.middleInitial ? user.middleInitial + "." : ""
    } ${user.lastname || ""}`.trim();

    // Safely convert timestamp to string if available
    let dobString = "Not Available";
    if (user.dob && typeof user.dob.toDate === "function") {
      try {
        dobString = user.dob.toDate().toISOString().split("T")[0];
      } catch (e) {
        // If error in timestamp conversion, use fallback
        dobString = "Not Available";
      }
    }

    // Create array of fields to search through
    const fieldsToSearch = [
      fullName,
      user.role || "Not Available",
      user.department || "Not Available",
      user.employeeID || "Not Available",
      user.gender || "Not Available",
      user.designation || "Not Available",
      dobString,
    ];

    // Return true if any field includes the search term
    return fieldsToSearch.some((field) =>
      String(field).toLowerCase().includes(searchLower)
    );
  };

  // Memoize filtered users for performance
  const filteredUsers = useMemo(() => {
    return users.filter((user) => user.employeeID?.trim()).filter(filterUsers);
  }, [users, search]);

  const handleAddUser = () => {
    setCurrentUser(null);
    setIsEditable(true);
    setUserForm({
      firstname: "",
      middleInitial: "",
      lastname: "",
      role: "Employee",
      department: "",
      designation: "",
      gender: "",
      employeeID: "",
    });
    setModalVisible(true);
  };

  const handleEdit = (user) => {
    setCurrentUser(user);
    setIsEditable(false);
    setUserForm({
      firstname: user.firstname.toUpperCase(),
      middleInitial: user.middleInitial ? user.middleInitial.toUpperCase() : "",
      lastname: user.lastname ? user.lastname.toUpperCase() : "",
      role: user.role,
      department: user.department,
      designation: user.designation || "",
      gender: user.gender || "",
      employeeID: user.employeeID || "",
      dob: user.dob ? user.dob.toDate().toISOString().split("T")[0] : "",
    });
    setModalVisible(true);
  };

  const handleSuspend = async (user) => {
    if (
      !window.confirm(
        `Are you sure you want to ${
          user.status === "Active" ? "suspend" : "activate"
        } this user?`
      )
    ) {
      return;
    }
    const db = getFirestore(app);
    const userRef = doc(db, "users", user.id);

    try {
      const newStatus = user.status === "Active" ? "Suspended" : "Active";
      await updateDoc(userRef, { status: newStatus });

      // Update local state immediately without refetching
      const updatedUsers = users.map((u) => {
        if (u.id === user.id) {
          return { ...u, status: newStatus };
        }
        return u;
      });

      setUsers(updatedUsers);
      saveToCache(updatedUsers);

      if (newStatus === "Active") {
        toast.success(`User ${user.firstname} ${user.lastname} is now Active.`);
      } else {
        toast.warn(`User ${user.firstname} ${user.lastname} is now Suspended.`);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status.");
    }
  };

  const handleDelete = async (user) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this user? This action cannot be undone.`
      )
    ) {
      return;
    }
    const db = getFirestore(app);
    const userRef = doc(db, "users", user.id);

    try {
      await deleteDoc(userRef);

      // Update local state immediately
      const updatedUsers = users.filter((u) => u.id !== user.id);
      setUsers(updatedUsers);
      saveToCache(updatedUsers);

      toast.success(
        `User ${user.firstname} ${user.lastname} deleted successfully!`
      );
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error("Failed to delete user.");
    }
  };

  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete all non-Admin users? This action cannot be undone.`
      )
    ) {
      return;
    }
    setIsDeleting(true);
    const db = getFirestore(app);
    const usersCollection = collection(db, "users");

    try {
      const snapshot = await getDocs(usersCollection);
      const usersToDelete = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Only include users who are NOT Admins for deletion
        if (data.role !== "Admin") {
          usersToDelete.push(docSnap.id);
        }
      });

      let batch = writeBatch(db);
      let batchCount = 0;

      for (let i = 0; i < usersToDelete.length; i++) {
        const userRef = doc(db, "users", usersToDelete[i]);
        batch.delete(userRef);
        batchCount++;

        if (batchCount === 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      // Commit any remaining deletions
      if (batchCount > 0) {
        await batch.commit();
      }

      // Update local state by getting remaining users (should be just Admins)
      const remainingSnapshot = await getDocs(usersCollection);
      const remainingUsers = remainingSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUsers(remainingUsers);
      saveToCache(remainingUsers);

      toast.success("All non-Admin users have been deleted.");
    } catch (error) {
      console.error("Failed to delete users:", error);
      toast.error("Failed to delete users.");
    } finally {
      setIsDeleting(false);
    }
  };

  const capitalizeWords = (str) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "dob") {
      setUserForm((prevForm) => ({
        ...prevForm,
        [name]: value,
      }));
    } else if (
      name === "firstname" ||
      name === "middleInitial" ||
      name === "lastname" ||
      name === "designation"
    ) {
      setUserForm((prevForm) => ({
        ...prevForm,
        [name]: value.toUpperCase(),
      }));
    } else if (name === "employeeID") {
      setUserForm((prevForm) => ({
        ...prevForm,
        [name]: value.toUpperCase().trim(),
      }));
    } else if (name === "department") {
      setUserForm((prevForm) => ({
        ...prevForm,
        [name]: capitalizeWords(value),
      }));
    } else {
      setUserForm((prevForm) => ({ ...prevForm, [name]: value }));
    }
  };

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!userForm.firstname) {
      errors.firstname = "First name is required";
      isValid = false;
    } else if (/\d/.test(userForm.firstname)) {
      errors.firstname = "First name cannot contain numbers";
      isValid = false;
    }

    if (!userForm.lastname) {
      errors.lastname = "Last name is required";
      isValid = false;
    } else if (/\d/.test(userForm.lastname)) {
      errors.lastname = "Last name cannot contain numbers";
      isValid = false;
    }
    if (!userForm.dob) {
      errors.dob = "Date of Birth is required";
      isValid = false;
    }

    if (!userForm.role) {
      errors.role = "Role is required";
      isValid = false;
    }

    if (!userForm.department) {
      errors.department = "Department is required";
      isValid = false;
    }

    if (!userForm.gender) {
      errors.gender = "Gender is required";
      isValid = false;
    }

    if (!userForm.employeeID) {
      errors.employeeID = "Employee ID is required";
      isValid = false;
    } else {
      const idExists = users.some(
        (u) =>
          u.employeeID?.toUpperCase() === userForm.employeeID.toUpperCase() &&
          u.id !== currentUser?.id
      );

      if (idExists) {
        errors.employeeID = "Employee ID already exists";
        isValid = false;
      }
    }

    if (!userForm.designation) {
      errors.designation = "Designation is required";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    const db = getFirestore(app);
    try {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.id);
        const updatedUserData = {
          firstname: userForm.firstname
            .toUpperCase()
            .trim()
            .replace(/\s+/g, " "),
          middleInitial: userForm.middleInitial.toUpperCase().trim(),
          lastname: userForm.lastname.toUpperCase().trim().replace(/\s+/g, " "),
          designation: userForm.designation,
          department: userForm.department,
          gender: userForm.gender,
          employeeID: userForm.employeeID || "Not Available",
          dob: userForm.dob ? Timestamp.fromDate(new Date(userForm.dob)) : null,
        };

        await updateDoc(userRef, updatedUserData);

        // Update local state
        const updatedUsers = users.map((u) => {
          if (u.id === currentUser.id) {
            return {
              ...u,
              ...updatedUserData,
              // Convert to the same format as our cached objects
              dob: updatedUserData.dob
                ? {
                    seconds: updatedUserData.dob.seconds,
                    nanoseconds: updatedUserData.dob.nanoseconds,
                    toDate: () => new Date(updatedUserData.dob.seconds * 1000),
                  }
                : null,
            };
          }
          return u;
        });

        setUsers(updatedUsers);
        saveToCache(updatedUsers);

        toast.success("User updated successfully!");
      } else {
        const newUserData = {
          firstname: userForm.firstname
            .toUpperCase()
            .trim()
            .replace(/\s+/g, " "),
          middleInitial: userForm.middleInitial.toUpperCase().trim(),
          lastname: userForm.lastname.toUpperCase().trim().replace(/\s+/g, " "),
          role: userForm.role,
          department: userForm.department,
          designation: userForm.designation,
          gender: userForm.gender,
          employeeID: userForm.employeeID || "Not Available",
          dob: userForm.dob ? Timestamp.fromDate(new Date(userForm.dob)) : null,
          createdAt: serverTimestamp(),
          status: "Active",
        };

        const userRef = doc(db, "users", userForm.employeeID);
        await setDoc(userRef, newUserData);

        // Add to local state
        const newUser = {
          id: userForm.employeeID,
          ...newUserData,
          // Convert to the same format as our cached objects
          dob: newUserData.dob
            ? {
                seconds: newUserData.dob.seconds,
                nanoseconds: newUserData.dob.nanoseconds,
                toDate: () => new Date(newUserData.dob.seconds * 1000),
              }
            : null,
          createdAt: {
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: 0,
            toDate: () => new Date(),
          },
        };

        const updatedUsers = [...users, newUser].sort((a, b) =>
          a.lastname?.localeCompare(b.lastname)
        );

        setUsers(updatedUsers);
        saveToCache(updatedUsers);

        toast.success(
          `${
            userForm.role.charAt(0).toUpperCase() + userForm.role.slice(1)
          } added successfully!`
        );
      }

      setModalVisible(false);
      setUserForm({
        firstname: "",
        lastname: "",
        role: "",
        department: "",
        designation: "",
        gender: "",
        employeeID: "",
        dob: "",
      });
      setCurrentUser(null);
      setIsEditable(false);
    } catch (error) {
      console.error("Failed to save user:", error);
      toast.error("Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sidebar>
      <ToastContainer position="top-right" autoClose={10000} />
      <div className="user-container">
        <div className="dashboard-header">
          <h1>Manage User Page</h1>
          <p className="dashboard-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="search-container">
          <input
            className="search-bar"
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value.trimStart())}
          />
          <div className="action-button-container">
            {/* Excel Upload Button - Redesigned */}
            <label className="upload-button">
              <FiUpload className="upload-icon" />
              {isUploading ? "Uploading..." : "Upload Excel"}
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                style={{ display: "none" }}
                disabled={isUploading}
              />
            </label>

            {/* Add Employee Button - Redesigned */}
            <button className="add-user-button" onClick={() => handleAddUser()}>
              <FiPlus className="add-icon" />
              Add Employee
            </button>

            {/* Delete All Button - Redesigned */}
            <button
              className="delete-all-button"
              onClick={handleDeleteAll}
              disabled={isDeleting}
            >
              <FiTrash2 className="delete-icon" />
              {isDeleting ? "Deleting..." : "Delete All"}
            </button>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th className="table-head" style={{ width: "60px" }}>
                    No.
                  </th>
                  <th className="table-head" style={{ width: "120px" }}>
                    Employee ID
                  </th>
                  <th className="table-head" style={{ width: "200px" }}>
                    Name
                  </th>
                  <th className="table-head" style={{ width: "150px" }}>
                    Date of Birth
                  </th>{" "}
                  <th className="table-head" style={{ width: "100px" }}>
                    Designation
                  </th>
                  <th className="table-head" style={{ width: "150px" }}>
                    Department
                  </th>
                  <th className="table-head" style={{ width: "100px" }}>
                    Gender
                  </th>
                  <th className="table-head" style={{ width: "120px" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`table-row ${
                      index % 2 === 0 ? "even-row" : "odd-row"
                    }`}
                    style={
                      user.status === "Suspended"
                        ? { backgroundColor: "#FFCCCB", opacity: 0.8 }
                        : {}
                    }
                  >
                    <td className="table-cell">{index + 1}</td>
                    <td className="table-cell">
                      {user.employeeID || "Not Available"}
                    </td>
                    <td className="table-cell">
                      {user.firstname}{" "}
                      {user.middleInitial ? user.middleInitial + ". " : ""}{" "}
                      {user.lastname || "Not Available"}
                    </td>
                    <td className="table-cell">
                      {/* Format the DOB if it exists */}
                      {user.dob
                        ? user.dob.toDate().toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Not Available"}
                    </td>
                    <td className="table-cell">
                      {user.designation || "Not Available"}
                    </td>
                    <td className="table-cell">
                      {user.department || "Not Available"}
                    </td>
                    <td className="table-cell">
                      {/* Gender Badge - keeping inline style for dynamic color */}
                      <span
                        className="gender-badge"
                        style={{
                          backgroundColor:
                            user.gender === "Male"
                              ? "#1e3a8a"
                              : user.gender === "Female"
                              ? "#d41c48"
                              : "#6c757d",
                        }}
                      >
                        {user.gender || "Not Available"}
                      </span>
                    </td>
                    <td className="action-cell">
                      {/* Edit Button */}
                      <button
                        className={`icon-button ${
                          hoveredUser === user.id && hoveredIcon === "edit"
                            ? "button-hover"
                            : ""
                        }`}
                        onMouseEnter={() => {
                          setHoveredUser(user.id);
                          setHoveredIcon("edit");
                        }}
                        onMouseLeave={() => setHoveredIcon(null)}
                        onClick={() => handleEdit(user)}
                        title="Edit"
                      >
                        <FiEdit />
                      </button>

                      {/* Suspend/Activate Button */}
                      {user.status === "Suspended" ? (
                        <button
                          className={`icon-button ${
                            hoveredUser === user.id && hoveredIcon === "suspend"
                              ? "button-hover"
                              : ""
                          }`}
                          onMouseEnter={() => {
                            setHoveredUser(user.id);
                            setHoveredIcon("suspend");
                          }}
                          onMouseLeave={() => setHoveredIcon(null)}
                          onClick={() => handleSuspend(user)}
                          title="Activate"
                        >
                          <FaUserCheck />
                        </button>
                      ) : (
                        <button
                          className={`icon-button ${
                            hoveredUser === user.id && hoveredIcon === "suspend"
                              ? "button-hover"
                              : ""
                          }`}
                          onMouseEnter={() => {
                            setHoveredUser(user.id);
                            setHoveredIcon("suspend");
                          }}
                          onMouseLeave={() => setHoveredIcon(null)}
                          onClick={() => handleSuspend(user)}
                          title="Suspend"
                        >
                          <FiUserX />
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        className={`icon-button ${
                          hoveredUser === user.id && hoveredIcon === "delete"
                            ? "button-hover"
                            : ""
                        }`}
                        onMouseEnter={() => {
                          setHoveredUser(user.id);
                          setHoveredIcon("delete");
                        }}
                        onMouseLeave={() => setHoveredIcon(null)}
                        onClick={() => handleDelete(user)}
                        title="Delete"
                      >
                        <FiTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalVisible && (
        <div
          className="user-modal"
          onClick={() => {
            setModalVisible(false);
            setFormErrors({});
            setIsEditable(false);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              {currentUser ? "Edit Employee" : "Add Employee"}
              <button
                onClick={() => setIsEditable(!isEditable)}
                className={`edit-button ${isHovered ? "button-hover" : ""}`}
                title="Edit"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <FiEdit />
              </button>
            </h2>
            <div className="form-row">
              <div className="half-width">
                <div className="form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    name="firstname"
                    value={userForm.firstname}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.firstname && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.firstname}
                    </p>
                  )}
                </div>
              </div>
              <div className="half-width">
                <div className="form-group">
                  <label>Middle Initial:</label>
                  <input
                    type="text"
                    name="middleInitial"
                    value={userForm.middleInitial}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.middleInitial && (
                    <p className="error-message">
                      <FiAlertCircle />
                    </p>
                  )}
                </div>
              </div>
              <div className="half-width">
                <div className="form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    name="lastname"
                    value={userForm.lastname}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.lastname && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.lastname}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="half-width">
                <div className="form-group">
                  <label>Gender:</label>
                  <select
                    name="gender"
                    value={userForm.gender}
                    onChange={handleFormChange}
                    className="user-select"
                    disabled={!isEditable}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {formErrors.gender && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.gender}
                    </p>
                  )}
                </div>
              </div>

              <div className="half-width">
                <div className="form-group">
                  <label>Employee ID:</label>
                  <input
                    type="text"
                    name="employeeID"
                    value={userForm.employeeID}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.employeeID && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.employeeID}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="half-width">
                <div className="form-group">
                  <label>Date of Birth:</label>
                  <input
                    type="date"
                    name="dob"
                    value={userForm.dob}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.dob && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.dob}
                    </p>
                  )}
                </div>
              </div>

              <div className="half-width">
                <div className="form-group">
                  <label>Department:</label>
                  <input
                    type="text"
                    name="department"
                    value={userForm.department}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.department && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.department}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="half-width">
                <div className="form-group">
                  <label>Designation:</label>
                  <input
                    type="text"
                    name="designation"
                    value={userForm.designation}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={!isEditable}
                  />
                  {formErrors.designation && (
                    <p className="error-message">
                      <FiAlertCircle />
                      {formErrors.designation}
                    </p>
                  )}
                </div>
              </div>

              <div className="half-width">
                <div className="form-group">
                  <label>Role:</label>
                  <input
                    type="text"
                    name="role"
                    value={userForm.role}
                    onChange={handleFormChange}
                    className="user-input"
                    disabled={true}
                  />
                  {formErrors.role && (
                    <p className="error-message">{formErrors.role}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Centered Save/Cancel buttons */}
            <div className="button-container">
              <button
                onClick={handleSaveUser}
                className="save-button"
                disabled={isSaving || !isEditable}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setModalVisible(false);
                  setFormErrors({});
                  setIsEditable(false);
                }}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
};

export default ManageUser;
