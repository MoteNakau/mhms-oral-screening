# Clinical Governance — MHMS Oral Screening v1

## Document Purpose

This document defines the clinical governance framework for the MHMS Oral Screening application used by the Kiribati Ministry of Health and Medical Services.

---

## 1. SYSTEM CLASSIFICATION

**This is a SCREENING AND REFERRAL system. It is NOT a diagnostic system.**

The application supports authorized MHMS dental personnel in:
- Conducting community oral health screenings
- Recording clinical findings using standardized methodology
- Identifying patients who require further clinical assessment
- Creating referrals for definitive care

The application does NOT:
- Diagnose oral cancer or any other condition
- Replace clinical judgment
- Provide treatment recommendations beyond referral
- Generate probability scores for any condition

---

## 2. CLINICAL STANDARDS

### DMFT / dmft
- Based on **WHO Oral Health Surveys: Basic Methods, 5th edition**
- Permanent dentition: 32 teeth (codes 11-18, 21-28, 31-38, 41-48)
- Primary dentition: 20 teeth (codes 51-55, 61-65, 71-75, 81-85)
- Missing teeth interpretation is age-dependent per WHO protocol
- **Age threshold for counting missing permanent teeth as M: 10 years**
  - Below age 10: missing permanent teeth are NOT counted as M
  - Age 10+: missing permanent teeth may be counted as M (due to caries)
  - This threshold requires MHMS clinical approval

### PUFA / pufa
- P = Pulpal involvement
- U = Ulceration from dental cause
- F = Fistula (sinus)
- A = Abscess
- Recorded at tooth level for teeth with caries
- Prevents impossible duplicate states

### Periodontal (CPITN)
- WHO Community Periodontal Index of Treatment Needs
- 6 sextants
- Codes: 0 (healthy), 1 (bleeding), 2 (calculus), 3 (pocket 4-5mm), 4 (pocket 6mm+), X (excluded), 9 (not recorded)
- **Exact coding protocol requires MHMS clinical confirmation**

### Oral Mucosal Screening
- Captures clinical findings without claiming diagnosis
- Appropriate language: "Suspicious oral lesion identified — clinical assessment/referral required"
- NEVER: "Oral cancer detected" or similar diagnostic language
- No numerical probability scores

---

## 3. ITEMS REQUIRING MHMS CLINICAL APPROVAL

The following items are provisionally implemented and require formal MHMS clinical approval before production use:

| Item | Status | Notes |
|------|--------|-------|
| Age threshold for M component (permanent) | **PROVISIONAL: 10 years** | Per WHO 5th edition guidance |
| Oral cancer referral criteria | **REQUIRES APPROVAL** | Configurable in application |
| Periodontal referral criteria | **REQUIRES APPROVAL** | CPITN code 4 in any sextant |
| Caries referral criteria | **REQUIRES APPROVAL** | PUFA indicators, severity |
| Photo consent policy | **REQUIRES POLICY** | Patient consent procedures |
| Data retention period | **REQUIRES POLICY** | How long to retain records |
| User access authorization | **REQUIRES PROCESS** | Who can access the system |
| Supervisor correction workflow | **REQUIRES APPROVAL** | How corrections are handled |

---

## 4. REFERRAL CRITERIA (PROVISIONAL)

### Oral Mucosal Lesion Referral
The following findings may trigger a referral (requires MHMS approval):
- Lesion present for more than 2 weeks
- Unexplained ulceration
- Red or white patch (erythroplakia/leukoplakia)
- Unexplained swelling or lump
- Unexplained numbness
- Difficulty swallowing
- Fixed mass in neck

### Periodontal Referral
- CPITN code 4 (deep pocket 6mm+) in any sextant
- Multiple sextants with CPITN code 3

### Caries Referral
- Severe early childhood caries
- Multiple decayed teeth requiring urgent treatment
- Pulpal involvement (PUFA P component)
- Abscess or fistula present

---

## 5. DATA PRIVACY

- All patient information is treated as confidential health information
- Clinical photographs are stored in PRIVATE Google Drive
- Google Sheets are NOT publicly accessible
- No patient data is stored in GitHub
- No PHI is logged to browser console
- Access is restricted to authorized MHMS dental personnel only

---

## 6. CLINICAL PHOTOGRAPH POLICY

**Requires MHMS approval before production use.**

Provisional guidelines:
- Photos are captured only when clinically indicated
- Photos support clinical assessment and referral
- Photos are stored securely and privately
- Patient consent must be obtained (per MHMS policy)
- Photos are NOT used for research without separate ethical approval

---

## 7. SYSTEM LIMITATIONS

- This system does NOT replace clinical examination
- Screening findings must be confirmed by qualified dental personnel
- The system does NOT provide treatment plans
- Referral decisions are clinical decisions made by the screener
- The system supports but does not automate clinical decision-making

---

## 8. VERSION CONTROL

- Clinical rules and referral criteria are versioned
- Changes to clinical rules require documented MHMS approval
- The application logs changes for auditability

---

## 9. REVIEW SCHEDULE

This clinical governance document should be reviewed:
- Before initial production deployment
- Annually thereafter
- Whenever clinical rules are modified
- When MHMS clinical protocols change

---

*Document Version: 1.0*
*Date: 2026*
*Status: PROVISIONAL — Requires MHMS Clinical Approval*
