import { useEffect, useState } from 'react'
import { getPatients } from '../db/database'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    getPatients()
      .then((savedPatients) => {
        if (isMounted) {
          setPatients(savedPatients)
        }
      })
      .catch((error) => console.error('Failed to load patients:', error))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const visiblePatients = patients.filter((patient) => {
    const query = searchTerm.toLowerCase()
    return patient.id.toLowerCase().includes(query) || patient.name.toLowerCase().includes(query)
  })

  return (
    <section className="patients-card">
      <div className="patients-header">
        <div className="patients-search">
          <label className="eyebrow">Search Patient</label>
          <div className="search-row">
            <input className="search-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by patient name or ID" />
            <button className="search-btn" type="button">SEARCH</button>
          </div>
        </div>
      </div>

      <div className="patients-table-wrap">
        <table className="patients-table">
          <thead>
            <tr>
              <th>PATIENT ID</th>
              <th>NAME</th>
              <th>SPECIES</th>
              <th>LAST VISIT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="5">Loading patients...</td></tr>
            ) : visiblePatients.length === 0 ? (
              <tr><td colSpan="5">No patients saved yet.</td></tr>
            ) : visiblePatients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.id}</td>
                <td><strong>{patient.name}</strong></td>
                <td>{patient.species}</td>
                <td>{patient.lastVisit}</td>
                <td><span className="status-badge">{patient.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
