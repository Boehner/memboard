import React, { useState, useEffect } from "react";
import { gatherLegitimacyInputs } from "../api/scoreServices.js"; // Use your existing method
import { explainLegitimacyScore } from "../utils/computeLegitimacyScore.js"; // Use your existing method
import { getMemoryProfile } from "../api/memory.js"; // Use your existing method
import pLimit from 'p-limit';
import ScoreBox from './ScoreBox';

// Function to convert data to CSV
const convertToCSV = (data) => {
  const header = Object.keys(data[0]).join(',');
  const rows = data.map((row) =>
    Object.values(row)
      .map((value) => (value === undefined ? "" : String(value))) // Convert each value to string
      .join(',')
  );
  return [header, ...rows].join('\n');
};

const BatchScoreComponent = () => {
  const [addresses, setAddresses] = useState([]); // Array of Ethereum addresses
  const [results, setResults] = useState([]); // To store the results
  const [loading, setLoading] = useState(false); // Loading state
  const [manualAddress, setManualAddress] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const [manualError, setManualError] = useState(null);
  const [error, setError] = useState(null); // Error state

  // Options for legitimacy score (same as in the app)
  const OPTIONS = {
    thresholds: {
      walletAgeDaysForFull: 365,
      walletTxFull: 250,
      memBalanceForFull: 15000,
      platformSoftCap: 5,
      platformHardCap: 10,
      ensAgeDaysForFull: 365,
      ensRenewalsForFull: 3,
    },
    stats: {
      txCountQuantiles: { p50: 12, p75: 55, p90: 200 },
      followerLogQuantiles: { p50: 1.5, p75: 3.2, p90: 5.0 },
    },
    weights: {
      identity: 0.32,
      wallet: 0.23,
      social: 0.17,
      ens: 0.09,
      memory: 0.12,
      external: 0.04,
      overlap: 0.03,
    },
  };

  // Function to add a delay between requests to prevent hitting rate limits
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to process addresses in batches
  const processAddresses = async (addresses) => {
    setLoading(true);
    const resultsArray = [];

    // Limit concurrency to avoid RPC rate limits
    const concurrency = 1; // Start with 1 to limit concurrent requests
    const limit = pLimit(concurrency);

    const tasks = addresses.map((addr) =>
      limit(async () => {
        try {
          const profile = await getMemoryProfile(addr);
          const inputs = await gatherLegitimacyInputs(addr, profile);
            const result = explainLegitimacyScore(inputs, OPTIONS);
            console.log(`profile:`, profile);
            console.log(`inputs:`, inputs);
            console.log('result:', result);
          await delay(2500); // Small delay between attempts to be gentle with APIs
          return result;
        } catch (error) {
          console.error(`Error processing address ${addr}:`, error && error.message ? error.message : error);
          return { address: addr, score: null, error: "Failed to fetch data" };
        }
      })
    );

    const settled = await Promise.all(tasks);
    for (const r of settled) if (r) resultsArray.push(r);

    setResults(resultsArray);
    setLoading(false);
  };

  // Simulate fetching addresses from an external source or file
  useEffect(() => {
    const fetchAddresses = async () => {
      const addresses = [
        "0xafF3b784D661b65adD6B05D91F4E4ddD6Ac1Dd9E",
      ];
      setAddresses(addresses); // Set the addresses to be processed
    };

    fetchAddresses();
  }, []);

  // Trigger processing when addresses are set
  useEffect(() => {
    if (addresses.length > 0) {
      processAddresses(addresses);
    }
  }, [addresses]);

  // Export data as CSV
  const exportCSV = () => {
    const csvData = convertToCSV(results);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mem-holders-scores.csv';
    link.click();
  };

  // Export data as JSON
  const exportJSON = () => {
    const jsonData = JSON.stringify(results, null, 2);  // Format the data nicely
    const blob = new Blob([jsonData], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mem-holders-scores.json';  // Download as JSON file
    link.click();
  };

  // Manual single-address check
  const handleManualCheck = async () => {
    if (!manualAddress) return;
    setManualLoading(true);
    setManualError(null);
    setManualResult(null);
    try {
      const profile = await getMemoryProfile(manualAddress);
      const inputs = await gatherLegitimacyInputs(manualAddress, profile);
      const result = explainLegitimacyScore(inputs, OPTIONS);
      setManualResult(result);
    } catch (err) {
      console.error('Manual check failed:', err);
      setManualError(err && err.message ? err.message : String(err));
    } finally {
      setManualLoading(false);
    }
  };

  const handleCopyManual = async () => {
    if (!manualResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(manualResult, null, 2));
      // small visual feedback
      // eslint-disable-next-line no-alert
      alert('Score JSON copied to clipboard');
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div>
      <h2>Batch Score Processing</h2>
      {/* Manual single address check */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <h3 className="text-sm font-medium mb-2">Manual Address Check</h3>
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 bg-black/20 p-2 rounded-md border border-white/10 text-sm"
            placeholder="0x... or name.eth"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
          <button
            className="px-3 py-2 bg-cyan-500 text-black rounded-md text-sm font-semibold"
            onClick={handleManualCheck}
            disabled={manualLoading}
          >
            {manualLoading ? 'Checking...' : 'Check'}
          </button>
          <button
            className="px-3 py-2 bg-gray-700 text-sm rounded-md"
            onClick={() => { setManualAddress(''); setManualResult(null); setManualError(null); }}
          >
            Clear
          </button>
        </div>

        {manualError && (
          <div className="mt-2 text-sm text-red-300">Error: {manualError}</div>
        )}

        {manualResult && (
          <div className="mt-3">
            <ScoreBox title={`Manual: ${manualAddress}`} score={manualResult.score} breakdown={manualResult.breakdown ?? manualResult} onCopyLabel={'Copy JSON'} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchScoreComponent;
