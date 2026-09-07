export default function Sync() {
  return (
    <section className="sync-card">
      <div className="sync-controls">
        <h3 className="eyebrow">Sync Controls</h3>
        <div className="controls-row">
          <button className="action-btn blue">▶ MANUAL SYNC</button>
          <button className="small-outline">⏸ PAUSE SYNC</button>
          <button className="small-outline">■ STOP SYNC</button>
        </div>
        <div className="sync-status">Current status: <strong>Syncing active - All devices connected</strong></div>
      </div>

      <div className="patients-table-wrap">
        <table className="patients-table staff-table">
          <thead>
            <tr>
              <th>DEVICE ID</th>
              <th>STAFF</th>
              <th>LAST SYNC</th>
              <th>PENDING ITEMS</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                <td>PWA-00{i}</td>
                <td>Staff {i}</td>
                <td>{i === 1 ? '2 min ago' : i === 2 ? '15 min ago' : '1 hour ago'}</td>
                <td>{i === 2 ? 2 : i === 3 ? 5 : 0}</td>
                <td>{i === 2 ? <span className="status-badge orange">Pending</span> : i === 3 ? <span className="status-badge gray">Offline</span> : <span className="status-badge">Synced</span>}</td>
                <td><button className="small-outline">FORCE SYNC</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
