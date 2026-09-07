export default function Treatment({ onBack }) {
  return (
    <section className="treatment-card">
      <div className="treatment-banner">
        <div className="treatment-banner-icon">✓</div>
        <div>
          <h2>Validated by Veterinarian</h2>
          <p>The treatment recommendation is ready for review.</p>
        </div>
      </div>

      <div className="treatment-panel">
        <div className="treatment-section treatment-highlight">
          <div className="treatment-section-title">DIAGNOSIS</div>
          <div className="treatment-section-body">
            Acute Dermatitis
          </div>
        </div>

        <div className="treatment-section">
          <div className="treatment-section-title">RECOMMENDED TREATMENT</div>
          <div className="treatment-section-body treatment-list">
            <ul>
              <li>Topical corticosteroid cream – apply twice daily</li>
              <li>Oral antihistamine as needed for itching</li>
              <li>Schedule follow-up in 7–10 days</li>
            </ul>
          </div>
        </div>

        <div className="treatment-section">
          <div className="treatment-section-title">PRESCRIPTION DETAILS</div>
          <div className="treatment-section-body">
            Dispense 30 g of medicated cream with clear usage instructions.
          </div>
        </div>

        <div className="treatment-section">
          <div className="treatment-section-title">VETERINARIAN NOTES</div>
          <div className="treatment-section-body">
            Monitor the lesion daily and stop treatment if signs of irritation worsen.
          </div>
        </div>
      </div>

      <div className="treatment-footer">
        <button className="secondary-btn small-back" type="button" onClick={onBack}>← Dashboard</button>
      </div>
    </section>
  )
}
