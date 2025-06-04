import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ladydoctor from "../assets/nurse-removebg-preview.png";
import doctorpatient from "../assets/doctor-patient-vector.png";
import "../styles/Login.css";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // Clear any existing sessions when Login component mounts
  useEffect(() => {
    const clearExistingSessions = async () => {
      // Clear any stored session data
      sessionStorage.removeItem("userData");

      // Sign out any existing Firebase user
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch (error) {
          console.error("Error signing out existing user:", error);
        }
      }
    };

    clearExistingSessions();
  }, []);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Check Firestore for user details
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        console.log("User details:", userDoc.data());
        navigate("/dashboard");
      } else {
        toast.error("User record not found. Please contact support.");
      }
    } catch (error) {
      toast.error("Invalid email or password.");
    }
  };

  // Handle guest login
  const handleGuestLogin = () => {
    const guestUserData = {
      firstname: "Guest",
      email: "guest@guest.com",
      role: "guest",
      isGuest: true,
    };

    // Use sessionStorage instead of localStorage
    sessionStorage.setItem("userData", JSON.stringify(guestUserData));
    navigate("/requestmedicine");
  };

  return (
    <div className="container">
      <ToastContainer position="top-right" autoClose={5000} />
      <div className="leftSection">
        <img src={doctorpatient} alt="Doctor & Patient" className="logo" />
      </div>

      <div className="rightSection">
        <img src={ladydoctor} alt="Admin Illustration" className="loginImage" />
        <h2 className="heading">Welcome Ma'am Amy!</h2>
        <p className="subText">Login to an Admin account to use the app</p>

        <div className="inputGroup">
          <div className="inputContainer">
            <div className="inputIcon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input
              type="email"
              placeholder="Email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {email.length > 0 && (
              <div className="validIcon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="inputGroup">
          <div className="inputContainer">
            <div className="inputIcon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="togglePassword"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                    clipRule="evenodd"
                  />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              )}
            </span>
          </div>
          <Link to="/forgotpassword" className="forgotPassword">
            Forgot password?
          </Link>
          <Link to="/register" className="forgotPassword">
            Register
          </Link>
        </div>

        <div className="button-container">
          <button className="login-button" onClick={handleLogin}>
            <svg
              className="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>Login</span>
          </button>

          <button className="guest-button" onClick={handleGuestLogin}>
            <svg
              className="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            <span>Login as Guest</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
