'use client';

import { useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Upload, CheckCircle, AlertCircle, FileText, X, Users } from 'lucide-react';
import Link from 'next/link';

interface ImportResult {
  name: string;
  student_id: number;
}
interface ImportError {
  row: number;
  error: string;
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [csvText, setCsvText] = useState('');

  function handleFile(f: File) {
    setFile(f);
    setResults(null);
    setErrors([]);
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) || '';
      setCsvText(text);
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
      const parsedLines = lines.slice(0, 6).map(line => {
        const result: string[] = [];
        let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
          else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
          else cur += ch;
        }
        result.push(cur.trim());
        return result;
      });
      if (parsedLines.length > 0) {
        setHeaders(parsedLines[0]);
        setPreview(parsedLines.slice(1));
      }
    };
    reader.readAsText(f);
  }

  async function importCSV() {
    if (!csvText) return;
    setLoading(true);
    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      setResults(data.results || []);
      setErrors(data.errors || []);
    } catch {
      setErrors([{ row: 0, error: 'Network error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">

        <div>
          <h1 className="text-2xl font-medium text-gray-900">Import Students from CSV</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Export registrations from Flocknote and upload the CSV file here
          </p>
        </div>

        {/* Instructions */}
        <div className="card p-5 space-y-3 text-sm text-gray-600">
          <p className="font-semibold text-gray-800">How to export from Flocknote:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>In Flocknote, go to <strong>Events → Religious Education Registration</strong></li>
            <li>Click <strong>Registrants</strong> → <strong>Export to CSV</strong></li>
            <li>Save the file and upload it below</li>
          </ol>
          <p className="text-xs text-gray-400">
            Recognized columns: First Name, Last Name, Birthdate, Grade, Gender, Shirt Size, School,
            Sacraments Received, Photo Release, Food Allergies, Medical Allergies, Special Learning Needs,
            Parent/Guardian Name, Parent/Guardian Phone, Emergency Contact Name/Phone.
          </p>
        </div>

        {/* Drop zone */}
        {!results && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${file ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={24} className="text-primary-500" />
                <div className="text-left">
                  <p className="font-medium text-primary-700">{file.name}</p>
                  <p className="text-sm text-primary-400">{(file.size / 1024).toFixed(1)} KB · {preview.length} data rows detected</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setPreview([]); setHeaders([]); setCsvText(''); }}
                  className="p-1 rounded-full hover:bg-primary-100 text-primary-400">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-600">Drop CSV file here or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">Flocknote registration export (.csv)</p>
              </>
            )}
          </div>
        )}

        {/* Preview table */}
        {headers.length > 0 && !results && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-medium text-gray-800 text-sm">Preview (first 5 rows)</p>
              <span className="text-xs text-gray-400">{preview.length} rows shown · may be more</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {headers.map((_, j) => (
                        <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[140px] truncate">{row[j] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import button */}
        {file && !results && (
          <div className="flex gap-3">
            <button onClick={() => { setFile(null); setPreview([]); setHeaders([]); setCsvText(''); }}
              className="btn-outlined flex-1">Clear</button>
            <button onClick={importCSV} disabled={loading} className="btn-filled flex-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing…
                </span>
              ) : `Import ${preview.length > 0 ? preview.length + '+' : ''} Students`}
            </button>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              errors.length === 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {errors.length === 0 ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <div>
                <p className="font-semibold">
                  {results.length} student{results.length !== 1 ? 's' : ''} imported successfully
                  {errors.length > 0 && ` · ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="card p-4 space-y-2">
                <p className="text-sm font-semibold text-red-700">Rows with errors (not imported):</p>
                {errors.map((e, i) => (
                  <p key={i} className="text-sm text-red-600">Row {e.row}: {e.error}</p>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="font-medium text-gray-800 text-sm">Imported Students</p>
                </div>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {results.map(r => (
                    <div key={r.student_id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        <span className="text-sm text-gray-800">{r.name}</span>
                      </div>
                      <Link href={`/students/${r.student_id}`}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setResults(null); setFile(null); setPreview([]); setHeaders([]); setCsvText(''); }}
                className="btn-outlined flex-1">Import Another File</button>
              <Link href="/students" className="btn-filled flex-1 text-center flex items-center justify-center gap-2">
                <Users size={16} /> View All Students
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
