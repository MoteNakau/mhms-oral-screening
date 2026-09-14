// MHMS Oral Screening - Tooth Chart Component
// Interactive tooth chart for DMFT/dmft recording
// WHO 5th edition compliant

import { useState } from 'react';
import type { ToothFinding, PermanentToothStatus, PrimaryToothStatus } from '../lib/types';
import { PERMANENT_TEETH, PRIMARY_TEETH } from '../lib/clinical';

interface ToothChartProps {
  dentition: 'permanent' | 'primary';
  findings: ToothFinding[];
  onToothClick: (toothCode: string, status: PermanentToothStatus | PrimaryToothStatus) => void;
}

// Status options for permanent teeth
const PERMANENT_STATUS_OPTIONS: { value: PermanentToothStatus; label: string; color: string }[] = [
  { value: 'sound', label: 'Sound', color: 'bg-white border-gray-300' },
  { value: 'decayed', label: 'Decayed (D)', color: 'bg-red-100 border-red-500' },
  { value: 'filled_decay', label: 'Filled w/ decay (D)', color: 'bg-red-200 border-red-600' },
  { value: 'filled', label: 'Filled (F)', color: 'bg-blue-100 border-blue-500' },
  { value: 'missing_caries', label: 'Missing-caries (M)', color: 'bg-gray-400 border-gray-600' },
  { value: 'missing_other', label: 'Missing-other', color: 'bg-gray-300 border-gray-400' },
  { value: 'excluded', label: 'Excluded', color: 'bg-gray-100 border-gray-200' },
  { value: 'not_recorded', label: 'Not recorded', color: 'bg-yellow-50 border-yellow-300' },
];

// Status options for primary teeth
const PRIMARY_STATUS_OPTIONS: { value: PrimaryToothStatus; label: string; color: string }[] = [
  { value: 'sound', label: 'Sound', color: 'bg-white border-gray-300' },
  { value: 'decayed', label: 'Decayed (d)', color: 'bg-red-100 border-red-500' },
  { value: 'filled_decay', label: 'Filled w/ decay (d)', color: 'bg-red-200 border-red-600' },
  { value: 'filled', label: 'Filled (f)', color: 'bg-blue-100 border-blue-500' },
  { value: 'missing_caries', label: 'Missing-caries (m)', color: 'bg-gray-400 border-gray-600' },
  { value: 'extracted_caries', label: 'Extracted-caries (e)', color: 'bg-gray-500 border-gray-700' },
  { value: 'missing_other', label: 'Missing-other', color: 'bg-gray-300 border-gray-400' },
  { value: 'extracted_other', label: 'Extracted-other', color: 'bg-gray-200 border-gray-300' },
  { value: 'excluded', label: 'Excluded', color: 'bg-gray-100 border-gray-200' },
  { value: 'not_recorded', label: 'Not recorded', color: 'bg-yellow-50 border-yellow-300' },
];

function getToothStatusClass(status: PermanentToothStatus | PrimaryToothStatus): string {
  switch (status) {
    case 'sound': return 'bg-white border-gray-300 text-gray-700';
    case 'decayed':
    case 'filled_decay': return 'bg-red-100 border-red-500 text-red-800';
    case 'filled': return 'bg-blue-100 border-blue-500 text-blue-800';
    case 'missing_caries':
    case 'extracted_caries': return 'bg-gray-500 border-gray-700 text-white';
    case 'missing_other':
    case 'extracted_other': return 'bg-gray-300 border-gray-400 text-gray-600';
    case 'excluded': return 'bg-gray-100 border-gray-200 text-gray-400';
    case 'not_recorded': return 'bg-yellow-50 border-yellow-300 text-yellow-700';
    default: return 'bg-white border-gray-300 text-gray-700';
  }
}

export default function ToothChart({ dentition, findings, onToothClick }: ToothChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const teeth = dentition === 'permanent' ? PERMANENT_TEETH : PRIMARY_TEETH;
  const statusOptions = dentition === 'permanent' ? PERMANENT_STATUS_OPTIONS : PRIMARY_STATUS_OPTIONS;

  const getFinding = (code: string) => findings.find(f => f.toothCode === code);

  // Organize teeth into quadrants for DISPLAY (viewer's perspective looking at patient)
  // Standard dental chart layout:
  //   Upper: [18 17 16 15 14 13 12 11] | [21 22 23 24 25 26 27 28]
  //   Lower: [48 47 46 45 44 43 42 41] | [31 32 33 34 35 36 37 38]
  //
  // Viewer's LEFT = Patient's RIGHT
  // Viewer's RIGHT = Patient's LEFT

  const getQuadrant = (teethList: string[], start: number, end: number) =>
    teethList.filter(t => {
      const num = parseInt(t);
      return num >= start && num <= end;
    });

  // For display, we need:
  // upperLeft (viewer's left, patient's right Q1): reversed 11-18 → 18,17,...,11
  // upperRight (viewer's right, patient's left Q2): 21-28 as is
  // lowerLeft (viewer's left, patient's right Q4): reversed 41-48 → 48,47,...,41
  // lowerRight (viewer's right, patient's left Q3): 31-38 as is
  let upperLeft: string[], upperRight: string[], lowerLeft: string[], lowerRight: string[];
  if (dentition === 'permanent') {
    upperLeft = getQuadrant(teeth, 11, 18).reverse();  // 18,17,16,15,14,13,12,11
    upperRight = getQuadrant(teeth, 21, 28);            // 21,22,23,24,25,26,27,28
    lowerLeft = getQuadrant(teeth, 41, 48).reverse();   // 48,47,46,45,44,43,42,41
    lowerRight = getQuadrant(teeth, 31, 38);            // 31,32,33,34,35,36,37,38
  } else {
    upperLeft = getQuadrant(teeth, 51, 55).reverse();   // 55,54,53,52,51
    upperRight = getQuadrant(teeth, 61, 65);            // 61,62,63,64,65
    lowerLeft = getQuadrant(teeth, 81, 85).reverse();   // 85,84,83,82,81
    lowerRight = getQuadrant(teeth, 71, 75);            // 71,72,73,74,75
  }

  const renderToothButton = (code: string) => {
    const finding = getFinding(code);
    const status = finding?.status || 'not_recorded';
    const isSelected = selectedTooth === code;

    return (
      <button
        key={code}
        type="button"
        onClick={() => setSelectedTooth(isSelected ? null : code)}
        className={`tooth-btn ${getToothStatusClass(status)} ${isSelected ? 'ring-2 ring-[#0066cc] ring-offset-1' : ''}`}
        aria-label={`Tooth ${code}, status: ${status}`}
        title={`Tooth ${code}: ${status}`}
      >
        {code}
      </button>
    );
  };

  const renderQuadrant = (teethList: string[]) => (
    <div className="flex gap-0.5 sm:gap-1">
      {teethList.map(renderToothButton)}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Tooth chart */}
      <div className="card p-3">
        <div className="text-xs text-gray-500 mb-2 text-center">
          {dentition === 'permanent' ? 'Permanent Dentition (32 teeth)' : 'Primary Dentition (20 teeth)'}
        </div>

        {/* Upper arch — viewer's perspective looking at patient */}
        <div className="flex justify-center gap-3 sm:gap-4 mb-2">
          {renderQuadrant(upperLeft)}  {/* Viewer's left = Patient's upper right (Q1: 18→11) */}
          <div className="w-px bg-gray-300" />
          {renderQuadrant(upperRight)} {/* Viewer's right = Patient's upper left (Q2: 21→28) */}
        </div>

        {/* Midline */}
        <div className="border-t border-b border-gray-300 py-1 text-center text-xs text-gray-400">
          ← Patient's Right | Patient's Left →
        </div>

        {/* Lower arch — viewer's perspective looking at patient */}
        <div className="flex justify-center gap-3 sm:gap-4 mt-2">
          {renderQuadrant(lowerLeft)}  {/* Viewer's left = Patient's lower right (Q4: 48→41) */}
          <div className="w-px bg-gray-300" />
          {renderQuadrant(lowerRight)} {/* Viewer's right = Patient's lower left (Q3: 31→38) */}
        </div>
      </div>

      {/* Status selector for selected tooth */}
      {selectedTooth && (
        <div className="card p-3">
          <div className="font-semibold text-sm mb-2">
            Tooth {selectedTooth} — Select Status:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map(opt => {
              const finding = getFinding(selectedTooth);
              const isActive = finding?.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onToothClick(selectedTooth, opt.value);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border-2 text-left
                    ${isActive
                      ? 'border-[#0066cc] bg-[#e6f0ff] text-[#0066cc]'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded border bg-white border-gray-300" /> Sound
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded border bg-red-100 border-red-500" /> Decayed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded border bg-blue-100 border-blue-500" /> Filled
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded border bg-gray-500 border-gray-700" /> Missing (caries)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded border bg-gray-300 border-gray-400" /> Missing (other)
        </span>
      </div>
    </div>
  );
}
