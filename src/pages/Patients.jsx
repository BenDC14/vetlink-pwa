export default function Patients() {
  return (
    <section className="patients-card">
      <div className="patients-header">
        <div className="patients-search">
          <label className="eyebrow">Search Patient</label>
          <div className="search-row">
            <input className="search-input" placeholder="Search by patient name or ID" />
            <button className="search-btn">SEARCH</button>
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
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td>PT-100{i}</td>
                <td><strong>Patient {i}</strong></td>
                <td>Canine</td>
                <td>2026-05-{10 - i}</td>
                <td><span className="status-badge">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
