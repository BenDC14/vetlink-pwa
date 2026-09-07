export default function Staff() {
  return (
    <section className="staff-card">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <button className="action-btn blue">+ Add New Staff</button>
      </div>

      <div className="patients-table-wrap">
        <table className="patients-table staff-table">
          <thead>
            <tr>
              <th>STAFF ID</th>
              <th>NAME</th>
              <th>ROLE</th>
              <th>DEVICE STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                <td>ST-00{i}</td>
                <td><strong>Staff Member {i}</strong></td>
                <td>{i === 3 ? 'Assistant' : 'Technician'}</td>
                <td>{i % 2 === 0 ? <span className="status-badge gray">Offline</span> : <span className="status-badge">Online</span>}</td>
                <td>
                  <button className="small-outline">EDIT</button>
                  <button className="small-outline">REMOVE</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
