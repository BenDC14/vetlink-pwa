export default function ClinicalAnalysis() {
  return (
    <>
      <div className="metric-grid">
        <div className="metric-card">
          <p className="metric-value">24</p>
          <span>Cases Today</span>
        </div>
        <div className="metric-card">
          <p className="metric-value">7</p>
          <span>Pending Results</span>
        </div>
        <div className="metric-card">
          <p className="metric-value">94%</p>
          <span>AI Accuracy</span>
        </div>
        <div className="metric-card">
          <p className="metric-value">8m</p>
          <span>Avg. Time</span>
        </div>
      </div>

      <section className="chart-card">
        <div className="chart-header">
          <h3>Weekly Case Analysis</h3>
        </div>
        <div className="chart-grid">
          {[1, 2, 3, 4, 5, 6].map((height, index) => (
            <div key={index} className="chart-bar" style={{ height: `${24 + index * 12}%` }} />
          ))}
        </div>
      </section>
    </>
  )
}