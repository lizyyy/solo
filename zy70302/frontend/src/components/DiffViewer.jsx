export function DiffViewer({ diff, before, after, title }) {
  if (diff && diff.length > 0) {
    return (
      <div>
        {title && <div className="section-title">{title}</div>}
        <div className="diff-viewer">
          <div className="diff-section">
            <h4>修改前</h4>
            {diff.map((d, i) => (
              <div key={i} className="diff-item removed">
                <span className="field">- {d.field}:</span>
                <span>{JSON.stringify(d.before)}</span>
              </div>
            ))}
          </div>
          <div className="diff-section">
            <h4>修改后</h4>
            {diff.map((d, i) => (
              <div key={i} className="diff-item added">
                <span className="field">+ {d.field}:</span>
                <span>{JSON.stringify(d.after)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      {title && <div className="section-title">{title}</div>}
      <div className="diff-viewer">
        <div className="diff-section">
          <h4>Payload</h4>
          <pre className="json-viewer">{JSON.stringify(after || before, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
