# Ingestion Audit & Import Report

This report documents the exact actions, warnings, and resolution policies applied by the SpeedTrail import engine when processing `expenses_export.csv`. 

Total Rows Scanned: **42**  
Total Anomalies Detected & Resolved: **18**

---

## Anomaly & Ingestion Log

| Row | Status | Action Applied | Description & Ingested State Details |
| :---: | :--- | :--- | :--- |
| **2** | ✅ IMPORTED | standard split | Imported expense row "February rent" of INR 48000 split among Aisha, Rohan, Priya, Meera. |
| **3** | ✅ IMPORTED | standard split | Imported expense row "Groceries BigBasket" of INR 2340 split among Aisha, Rohan, Priya, Meera. |
| **4** | ✅ IMPORTED | standard split | Imported expense row "Wifi bill Feb" of INR 1199 split among Aisha, Rohan, Priya, Meera. |
| **5** | ✅ IMPORTED | standard split | Imported expense row "Dinner at Marina Bites" of INR 3200 split among Aisha, Rohan, Priya, Dev. |
| **6** | ⚠️ SKIPPED | duplicate merge | Skipped duplicate row "dinner - marina bites" (matched row 5 by date, payer, and amount). |
| **7** | ✅ IMPORTED | strip formatting | Stripped quoted comma amount `"1,200"` and imported as numeric `1200.00` INR, split equally among Aisha, Rohan, Priya, Meera. |
| **8** | ✅ IMPORTED | standard split | Imported expense row "Maid salary Feb" of INR 3000 split among Aisha, Rohan, Priya, Meera. |
| **9** | ✅ IMPORTED | normalization | Normalized payer casing `priya` to flatmate account `Priya`. Imported as INR 640.00 split among Aisha, Rohan, Priya. |
| **10** | ✅ IMPORTED | rounding | Rounded decimal precision `899.995` to standard `900.00` INR, split equally among Aisha, Rohan, Priya, Meera. |
| **11** | ✅ IMPORTED | mapper resolve | Mapped name variation `Priya S` to flatmate account `Priya`. Imported as INR 1875.00 split among Aisha, Rohan, Priya, Meera. |
| **12** | ✅ IMPORTED | unequal split | Imported unequal split "Aisha birthday cake" of INR 1500.00 split as: Rohan 700; Priya 400; Meera 400. |
| **13** | ✅ IMPORTED | drop-down resolve | Resolved missing payer field by assigning payer to `Rohan` via user manual resolution. Imported as INR 780.00 split among Aisha, Rohan, Priya, Meera. |
| **14** | 🔁 CONVERTED | convert to payment | Converted expense row "Rohan paid Aisha back" of INR 5000.00 to a direct `Settlement` from Rohan to Aisha, adjusting balances directly instead of split expense. |
| **15** | ✅ IMPORTED | percentage scale | Percentages sum to 110%. Scaled sum proportionally to 100% (Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18%). Imported as INR 1440.00. |
| **16** | ✅ IMPORTED | standard split | Imported expense row "March rent" of INR 48000 split among Aisha, Rohan, Priya, Meera. |
| **17** | ✅ IMPORTED | standard split | Imported expense row "Groceries BigBasket" of INR 2810 split among Aisha, Rohan, Priya, Meera. |
| **18** | ✅ IMPORTED | standard split | Imported expense row "Wifi bill Mar" of INR 1199 split among Aisha, Rohan, Priya, Meera. |
| **19** | ✅ IMPORTED | standard split | Imported expense row "Goa flights" of INR 32400 split among Aisha, Rohan, Priya, Dev. |
| **20** | ✅ IMPORTED | rate conversion | Ingested multi-currency USD 540.00 villa booking. Converted to INR 51300.00 using conversion rate (1 USD = 95 INR), split equally among Aisha, Rohan, Priya, Dev. |
| **21** | ✅ IMPORTED | rate conversion | Ingested multi-currency USD 84.00 beach shack. Converted to INR 7980.00 using conversion rate (1 USD = 95 INR), split equally among Aisha, Rohan, Priya, Dev. |
| **22** | ✅ IMPORTED | share split | Imported share split "Scooter rentals" of INR 3600.00 (Total shares: 6). Split as: Aisha 600, Rohan 1200, Priya 600, Dev 1200. |
| **23** | ✅ IMPORTED | guest split | Non-member split "Kabir" detected. Kabir's share assigned to payer Dev. Imported USD 150.00 as INR 14250.00, split as 2 shares to Dev, and 1 share each to Aisha, Rohan, Priya. |
| **24** | ⚠️ SKIPPED | duplicate resolve | Skipped duplicate row "Dinner at Thalassa" (conflicting amount, user resolved to keep Rohan's row 25). |
| **25** | ✅ IMPORTED | standard split | Imported expense row "Thalassa dinner" of INR 2450.00 split among Aisha, Rohan, Priya, Dev. |
| **26** | ✅ IMPORTED | refund split | Ingested negative transaction "Parasailing refund" of USD -30.00. Converted to INR -2850.00, credited proportionally, reducing roommate balances. |
| **27** | ✅ IMPORTED | normalization | Trimmed trailing whitespace from payer name `rohan ` to `Rohan`, parsed date format `Mar-14` to standard `2026-03-14`. Imported as INR 1100.00 split among Aisha, Rohan, Priya, Dev. |
| **28** | ✅ IMPORTED | currency resolve | Resolved missing currency code by defaulting to group base currency `INR`. Imported as INR 2105.00 split among Aisha, Rohan, Priya, Meera. |
| **29** | ✅ IMPORTED | standard split | Imported expense row "Electricity Mar" of INR 1450 split among Aisha, Rohan, Priya, Meera. |
| **30** | ✅ IMPORTED | standard split | Imported expense row "Maid salary Mar" of INR 3000 split among Aisha, Rohan, Priya, Meera. |
| **31** | ℹ️ IMPORTED AS ZERO | zero amount | Alerted user to zero amount Swiggy Swerve. Ingested as 0 value expense as requested in notes. |
| **32** | ✅ IMPORTED | percentage scale | Percentages sum to 110%. Scaled sum proportionally to 100% (Aisha 27.27%, Rohan 27.27%, Priya 27.27%, Meera 18.18%). Imported as INR 2200.00. |
| **33** | ✅ IMPORTED | standard split | Imported expense row "Meera farewell dinner" of INR 4800 split among Aisha, Rohan, Priya, Meera. |
| **34** | ✅ IMPORTED | date resolve | Resolved ambiguous date `04-05-2026` by interpreting as DD-MM format (`May 4, 2026`) per user selection. Imported as INR 2500.00 split among Aisha, Rohan, Priya. |
| **35** | ✅ IMPORTED | share split | Imported share split "April rent" of INR 48000.00 (Total shares: 4). Split as: Aisha 24000, Rohan 12000, Priya 12000. |
| **36** | ✅ IMPORTED | temporal split | Date `April 2` is outside active membership of Meera (who left March 31). Excluded Meera and split INR 2640.00 equally among active members Aisha, Rohan, Priya. |
| **37** | ✅ IMPORTED | standard split | Imported expense row "Wifi bill Apr" of INR 1199 split among Aisha, Rohan, Priya. |
| **38** | 🔁 CONVERTED | convert to payment | Converted "Sam deposit share" of INR 15000.00 to a direct `Settlement` from Sam to Aisha, adjusting balances directly. |
| **39** | ✅ IMPORTED | standard split | Imported expense row "Housewarming drinks" of INR 3100 split among Aisha, Rohan, Priya, Sam. |
| **40** | ✅ IMPORTED | standard split | Imported expense row "Electricity Apr" of INR 1380 split among Aisha, Rohan, Priya, Sam. |
| **41** | ✅ IMPORTED | standard split | Imported expense row "Groceries DMart" of INR 1990 split among Aisha, Rohan, Priya, Sam. |
| **42** | ✅ IMPORTED | redundant details | Equal split chosen, but redundant split details were provided. Ignored split details and imported equal split of INR 12000.00 among Aisha, Rohan, Priya, Sam. |
| **43** | ✅ IMPORTED | standard split | Imported expense row "Maid salary Apr" of INR 3000 split among Aisha, Rohan, Priya, Sam. |
