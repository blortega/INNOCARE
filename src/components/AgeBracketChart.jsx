// AgeBracketChart.js
import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { db } from "../firebase";

const MALE_COLOR = "#0088FE";
const FEMALE_COLOR = "#FF69B4";

const getAgeBracket = (dob) => {
  const now = new Date();
  const birthDate = new Date(dob);
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;

  if (age <= 25) return "18-25";
  if (age <= 35) return "25-35";
  if (age <= 45) return "35-45";
  if (age <= 55) return "45-55";
  return "55+";
};

const AGE_BRACKETS = ["18-25", "25-35", "35-45", "45-55", "55+"];

const AgeBracketChart = () => {
  const [ageGenderData, setAgeGenderData] = useState([]);
  const [totalPopulation, setTotalPopulation] = useState(0);

  useEffect(() => {
    const fetchAgeGenderData = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const dataMap = {};

        AGE_BRACKETS.forEach((bracket) => {
          dataMap[bracket] = { name: bracket, Male: 0, Female: 0 };
        });

        let population = 0;

        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          const gender = data.gender;
          if (!data.dob || !gender) return;

          let dobDate;
          try {
            dobDate =
              typeof data.dob === "string"
                ? new Date(data.dob)
                : data.dob.toDate?.() || null;
          } catch {
            return;
          }

          if (!dobDate || isNaN(dobDate.getTime())) return;

          const bracket = getAgeBracket(dobDate);
          if (!dataMap[bracket]) return;

          if (gender === "Male" || gender === "Female") {
            dataMap[bracket][gender] += 1;
            population++;
          }
        });

        const formattedData = Object.values(dataMap);
        setAgeGenderData(formattedData);
        setTotalPopulation(population);
      } catch (error) {
        console.error("Failed to fetch age/gender bracket data:", error);
      }
    };

    fetchAgeGenderData();
  }, []);

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <span className="card-icon">📊</span>
        <h2>User Age & Gender Distribution</h2>
      </div>
      <div className="card-subheader">
        <p>
          <strong>Total Population:</strong> {totalPopulation}
        </p>
      </div>
      <div className="card-content">
        <ResponsiveContainer width="100%" height={"120%"}>
          <BarChart
            data={ageGenderData}
            margin={{ top: 20, right: 20, left: 10, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Male" fill={MALE_COLOR} />
            <Bar dataKey="Female" fill={FEMALE_COLOR} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AgeBracketChart;
