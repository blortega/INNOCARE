import { useState, useRef, useEffect } from "react";
import {
  FiMenu,
  FiBell,
  FiSettings,
  FiUsers,
  FiBarChart2,
  FiClipboard,
  FiChevronUp,
  FiChevronDown,
  FiUser,
  FiLogOut,
  FiShoppingCart,
  FiFileText,
  FiPackage,
  FiGrid,
  FiLock,
} from "react-icons/fi";
import { NavLink, useNavigate, Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { RingLoader } from "react-spinners";

// Define the sidebar links with accessibility information
const sidebarLinks = [
  {
    to: "/dashboard",
    icon: <FiGrid />,
    label: "Dashboard",
    guestAccess: false,
  },
  {
    to: "/inventory",
    icon: <FiPackage />,
    label: "Inventory",
    guestAccess: false,
  },
  {
    to: "/manage-user",
    icon: <FiUsers />,
    label: "User Management",
    guestAccess: false,
  },
  {
    to: "/records",
    icon: <FiFileText />,
    label: "Records",
    guestAccess: false,
  },
  {
    to: "/thirdpartyrecord",
    icon: <FiFileText />,
    label: "Third Party Records",
    guestAccess: false,
  },
  {
    to: "/requestmedicine",
    icon: <FiShoppingCart />,
    label: "Request Medicine",
    guestAccess: true,
  },
  {
    to: "/reports",
    icon: <FiBarChart2 />,
    label: "Reports",
    guestAccess: false,
  },
];

const Sidebar = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [hoveredItem, setHoveredItem] = useState("");
  const [hoveredLink, setHoveredLink] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Check for existing guest session on mount
  useEffect(() => {
    const storedUserData = sessionStorage.getItem("userData");
    if (storedUserData) {
      try {
        const parsedUserData = JSON.parse(storedUserData);
        if (parsedUserData.isGuest === true) {
          setUserData(parsedUserData);
          setIsGuest(true);
          setUserLoading(false);

          // If user is guest and not on request medicine page, redirect them
          if (window.location.pathname !== "/requestmedicine") {
            navigate("/requestmedicine");
          }
          return; // Don't let Firebase auth override guest session
        }
      } catch (error) {
        console.error("Error parsing stored user data:", error);
        sessionStorage.removeItem("userData");
      }
    }
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Check if we're in guest mode first - don't let Firebase override
      const storedData = sessionStorage.getItem("userData");
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          if (parsedData.isGuest === true) {
            // We're in guest mode, ignore Firebase auth changes
            console.log("Guest mode active, ignoring Firebase auth state");
            return;
          }
        } catch (error) {
          console.error("Error parsing session data:", error);
        }
      }

      if (user) {
        setUserLoading(true);
        setIsGuest(false);

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userDataFromFirestore = userDoc.data();
            setUserData(userDataFromFirestore);
            sessionStorage.setItem(
              "userData",
              JSON.stringify(userDataFromFirestore)
            );
          } else {
            console.error("User document not found.");
            const basicUserData = {
              firstname: user.displayName || "User",
              email: user.email,
              isGuest: false,
            };
            setUserData(basicUserData);
            sessionStorage.setItem("userData", JSON.stringify(basicUserData));
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          const basicUserData = {
            firstname: user.displayName || "User",
            email: user.email,
            isGuest: false,
          };
          setUserData(basicUserData);
          sessionStorage.setItem("userData", JSON.stringify(basicUserData));
        } finally {
          setUserLoading(false);
        }
      } else {
        // No Firebase user - check if we have guest data
        const storedData = sessionStorage.getItem("userData");
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            if (parsedData.isGuest) {
              setUserData(parsedData);
              setIsGuest(true);
            } else {
              // Clear non-guest data if no Firebase user
              setUserData(null);
              setIsGuest(false);
              sessionStorage.removeItem("userData");
            }
          } catch (error) {
            console.error("Error parsing session data:", error);
            sessionStorage.removeItem("userData");
            setUserData(null);
            setIsGuest(false);
          }
        } else {
          setUserData(null);
          setIsGuest(false);
        }
        setUserLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Enhanced session cleanup on browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const userData = sessionStorage.getItem("userData");
      if (userData) {
        try {
          const parsedData = JSON.parse(userData);
          if (parsedData.isGuest) {
            sessionStorage.removeItem("userData");
          }
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      }
    };

    // Also handle visibility change for better mobile support
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const userData = sessionStorage.getItem("userData");
        if (userData) {
          try {
            const parsedData = JSON.parse(userData);
            if (parsedData.isGuest) {
              sessionStorage.removeItem("userData");
            }
          } catch (error) {
            console.error("Error during visibility cleanup:", error);
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Clear session storage first
      sessionStorage.removeItem("userData");

      // If the user is logged in with Firebase, sign them out
      if (auth.currentUser && !isGuest) {
        await signOut(auth);
        console.log("Firebase user signed out");
      }

      // Reset state
      setUserData(null);
      setIsGuest(false);

      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Component for locked navigation item
  const LockedNavItem = ({ icon, label }) => (
    <div
      style={{
        ...styles.sidebarLink,
        ...styles.lockedLink,
        ...(hoveredLink === label ? styles.lockedLinkHover : {}),
      }}
      onMouseEnter={() => setHoveredLink(label)}
      onMouseLeave={() => setHoveredLink("")}
    >
      {icon}{" "}
      {!isCollapsed && (
        <>
          {label} <FiLock style={styles.lockIcon} />
        </>
      )}
    </div>
  );

  // If no user data and not loading, redirect to login
  if (!userLoading && !userData) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside
        style={{ ...styles.sidebar, width: isCollapsed ? "60px" : "250px" }}
      >
        {/* Toggle Button */}
        <button
          style={{
            ...styles.toggleButton,
            ...(hoveredLink === "toggle" ? styles.toggleButtonHover : {}),
          }}
          onClick={() => setIsCollapsed(!isCollapsed)}
          onMouseEnter={() => setHoveredLink("toggle")}
          onMouseLeave={() => setHoveredLink("")}
        >
          <FiMenu size={24} style={{ color: "#000" }} />
        </button>

        <nav style={styles.navLinks}>
          {sidebarLinks.map(({ to, icon, label, guestAccess }) => {
            // For guest users, render locked or accessible links
            if (isGuest && !guestAccess) {
              return <LockedNavItem key={label} icon={icon} label={label} />;
            }

            // For regular users or accessible guest links
            return (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  ...styles.sidebarLink,
                  ...(isActive ? styles.activeLink : {}),
                  ...(hoveredLink === to && !isActive
                    ? styles.sidebarLinkHover
                    : {}),
                })}
                onMouseEnter={() => setHoveredLink(to)}
                onMouseLeave={() => setHoveredLink("")}
              >
                {icon} {!isCollapsed && label}
              </NavLink>
            );
          })}
        </nav>

        {/* User Dropdown */}
        <div style={styles.userContainer} ref={dropdownRef}>
          <div
            style={{
              ...styles.userButton,
              ...(hoveredLink === "userProfile" ? styles.userButtonHover : {}),
            }}
            onClick={() => setShowDropdown(!showDropdown)}
            onMouseEnter={() => setHoveredLink("userProfile")}
            onMouseLeave={() => setHoveredLink("")}
          >
            <FiUser style={styles.userIcon} />
            {!isCollapsed && (
              <div>
                {userLoading ? (
                  <div style={styles.userLoading}>
                    <RingLoader size={15} color="#2d97e9" />
                  </div>
                ) : (
                  <>
                    <span style={styles.userName}>
                      {userData ? userData.firstname : "Guest"}
                    </span>
                    <p style={styles.userEmail}>
                      {userData ? userData.email : "guest@guest.com"}
                    </p>
                  </>
                )}
              </div>
            )}
            {!isCollapsed &&
              (showDropdown ? (
                <FiChevronUp style={{ color: "#333" }} />
              ) : (
                <FiChevronDown style={{ color: "#333" }} />
              ))}
          </div>

          {/* Dropdown Items */}
          <div
            style={{
              ...styles.dropdown,
              maxHeight: showDropdown ? "200px" : "0",
              opacity: showDropdown ? 1 : 0,
            }}
          >
            {!isGuest && (
              <button
                style={{
                  ...styles.dropdownItem,
                  ...(hoveredItem === "account"
                    ? styles.dropdownItemHover
                    : {}),
                }}
                onClick={() => navigate("/account")}
                onMouseEnter={() => setHoveredItem("account")}
                onMouseLeave={() => setHoveredItem("")}
              >
                {hoveredItem === "account" ? (
                  <FiUser style={styles.dropdownItemIconHover} />
                ) : (
                  <FiUser />
                )}
                Account Settings
              </button>
            )}
            <button
              style={{
                ...styles.dropdownItem,
                ...(hoveredItem === "signOut" ? styles.dropdownItemHover : {}),
              }}
              onClick={handleLogout}
              disabled={loading}
              onMouseEnter={() => setHoveredItem("signOut")}
              onMouseLeave={() => setHoveredItem("")}
            >
              {loading ? (
                <RingLoader size={24} color="#ffffff" />
              ) : (
                <>
                  {hoveredItem === "signOut" ? (
                    <FiLogOut style={styles.dropdownItemIconHover} />
                  ) : (
                    <FiLogOut />
                  )}
                  {isGuest ? "Exit Guest Mode" : "Sign Out"}
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          ...styles.contentWrapper,
          marginLeft: isCollapsed ? "60px" : "250px",
        }}
      >
        {isGuest && window.location.pathname !== "/requestmedicine" ? (
          <Navigate to="/requestmedicine" replace />
        ) : (
          children
        )}
      </main>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    width: "100vw",
    minHeight: "100vh",
    background: "#f5f6fa",
  },
  sidebar: {
    height: "100vh",
    backgroundColor: "white",
    boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    padding: "10px",
    position: "fixed",
    left: 0,
    top: 0,
    overflowY: "auto",
    transition: "width 0.3s ease-in-out",
  },
  contentWrapper: {
    flexGrow: 1,
    padding: "20px",
    transition: "margin-left 0.3s ease-in-out",
  },
  toggleButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "10px",
    alignSelf: "flex-start",
    borderRadius: "5px",
    transition: "all 0.2s ease-in-out",
  },
  toggleButtonHover: {
    background: "#f0f0f0",
    transform: "scale(1.05)",
  },
  logoText: {
    fontSize: "1.2rem",
    fontWeight: "bold",
    color: "#2d97e9",
    marginBottom: "20px",
    textAlign: "center",
  },
  navLinks: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sidebarLink: {
    display: "flex",
    alignItems: "center",
    padding: "10px",
    textDecoration: "none",
    color: "#333",
    borderRadius: "5px",
    transition: "all 0.3s ease",
    gap: "10px",
    fontSize: "1rem",
  },
  sidebarLinkHover: {
    backgroundColor: "#f0f7ff",
    color: "#2d97e9",
    transform: "translateX(5px)",
    boxShadow: "0 2px 5px rgba(45, 151, 233, 0.1)",
  },
  activeLink: {
    backgroundColor: "#2d97e9",
    color: "white",
    fontWeight: "bold",
  },
  // Styles for locked links
  lockedLink: {
    color: "#aaa",
    cursor: "not-allowed",
    position: "relative",
    backgroundColor: "#f8f8f8",
    opacity: 0.7,
  },
  lockedLinkHover: {
    backgroundColor: "#f0f0f0",
    color: "#aaa",
    transform: "translateX(0)",
    boxShadow: "none",
  },
  lockIcon: {
    marginLeft: "5px",
    fontSize: "0.8rem",
  },
  userContainer: {
    position: "absolute",
    bottom: "20px",
    width: "100%",
    padding: "10px",
    borderTop: "1px solid #ddd",
  },
  userButton: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#333",
    transition: "all 0.3s ease",
    gap: "10px",
    borderRadius: "5px",
  },
  userButtonHover: {
    backgroundColor: "#f0f7ff",
    transform: "translateY(-2px)",
  },
  userIcon: {
    fontSize: "1.5rem",
    color: "#2d97e9",
  },
  userName: {
    fontSize: "1rem",
    fontWeight: "bold",
    color: "#333",
  },
  userEmail: {
    fontSize: "0.8rem",
    color: "#666",
    margin: "0",
  },
  userLoading: {
    display: "flex",
    alignItems: "center",
    height: "35px",
    justifyContent: "center",
  },
  dropdown: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    background: "#2d5b89",
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
    borderRadius: "10px",
    padding: "0",
    width: "100%",
    zIndex: 10,
    overflow: "hidden",
    transition: "max-height 0.3s ease-out, opacity 0.3s ease-out",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "none",
    color: "white",
    border: "none",
    padding: "12px",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "1rem",
    transition: "all 0.25s ease-in-out",
    position: "relative",
    overflow: "hidden",
  },
  dropdownItemHover: {
    background: "linear-gradient(90deg, #2d97e9, #1a4d6f)",
    transform: "translateX(5px)",
    boxShadow: "inset 0 0 10px rgba(255, 255, 255, 0.1)",
    paddingLeft: "17px",
    color: "#ffffff",
    letterSpacing: "0.5px",
  },
  dropdownItemIconHover: {
    transform: "scale(1.2)",
    color: "#ffffff",
    transition: "all 0.25s ease-in-out",
  },
};

export default Sidebar;
