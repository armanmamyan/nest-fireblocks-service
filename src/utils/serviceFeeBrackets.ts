export const FEE_BRACKETS = [
  // Each object has a range (min/max) and a 'fixedFee' or 'percentFee' field
  { min: 0, max: 10000, fixedFee: 5 },
  { min: 10000, max: 20000, fixedFee: 7 },
  { min: 20000, max: 30000, fixedFee: 8 },
  { min: 30000, max: 40000, fixedFee: 9 },
  { min: 40000, max: 100000, fixedFee: 10 },
  // For amounts above 100K, we’ll define percentFee instead of a fixedFee
  { min: 100000, max: Infinity, percentFee: 0.00003 }, // 0.003%
];
