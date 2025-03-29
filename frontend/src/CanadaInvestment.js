import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import './App.css';

function CanadaInvestment() {
  const [investments, setInvestments] = useState([]);

  useEffect(() => {
    const initialData = [
      {
        asset: "PETR4",
        quantity: 100,
        avgPrice: 25.0,
        currentPrice: 26.0,
        investedValue: 2500,
        balance: 2600,
        variation: 4,
        dividendPerShare: 1.5,
        currentDYMonthly: 0.5,
        currentDYAnnual: 6,
        myDYMonthly: 0.45,
        myDYAnnual: 5.4
      },
      {
        asset: "VALE3",
        quantity: 50,
        avgPrice: 70.0,
        currentPrice: 72.0,
        investedValue: 3500,
        balance: 3600,
        variation: 2.86,
        dividendPerShare: 2.0,
        currentDYMonthly: 0.6,
        currentDYAnnual: 7.2,
        myDYMonthly: 0.55,
        myDYAnnual: 6.6
      }
    ];
    setInvestments(initialData);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setInvestments(prevInvestments =>
        prevInvestments.map(item => {
          const fluctuation = (Math.random() - 0.5) * 0.1 * item.currentPrice;
          const newCurrentPrice = +(item.currentPrice + fluctuation).toFixed(2);
          const newBalance = +(item.quantity * newCurrentPrice).toFixed(2);
          const newVariation = +(((newCurrentPrice - item.avgPrice) / item.avgPrice) * 100).toFixed(2);
          return {
            ...item,
            currentPrice: newCurrentPrice,
            balance: newBalance,
            variation: newVariation
          };
        })
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="investment-container">
      <h1>Investment Tracker (Canada)</h1>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Quantity</th>
            <th>Average Price</th>
            <th>Current Price</th>
            <th>Invested Value</th>
            <th>Balance</th>
            <th>Variation (%)</th>
            <th>Dividend per Share</th>
            <th>Current DY (Monthly)</th>
            <th>Current DY (Annual)</th>
            <th>My DY (Monthly)</th>
            <th>My DY (Annual)</th>
          </tr>
        </thead>
        <tbody>
          {investments.map((item, index) => (
            <tr key={index}>
              <td>{item.asset}</td>
              <td>{item.quantity}</td>
              <td>{item.avgPrice}</td>
              <td>{item.currentPrice}</td>
              <td>{item.investedValue}</td>
              <td>{item.balance}</td>
              <td>{item.variation}</td>
              <td>{item.dividendPerShare}</td>
              <td>{item.currentDYMonthly}</td>
              <td>{item.currentDYAnnual}</td>
              <td>{item.myDYMonthly}</td>
              <td>{item.myDYAnnual}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Investment Overview</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={investments} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="asset" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="investedValue" name="Invested Value" fill="#8884d8" />
          <Bar dataKey="balance" name="Balance" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CanadaInvestment;
