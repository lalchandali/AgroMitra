import { useEffect, useState } from 'react'
import { getModelInfo } from '../api/agromitra'

export default function ModelDisclosure({
  modelKey,
  cropName,
  district,
  modelName,
  message,
  lowConfidence = false,
  lang = 'en',
}) {
  const [info, setInfo] = useState(null)
  const [infoError, setInfoError] = useState(false)

  useEffect(() => {
    let active = true
    getModelInfo(modelKey, cropName, district)
      .then(({ data }) => {
        if (active) setInfo(data)
      })
      .catch((error) => {
        console.error(`Could not load ${modelKey} model information:`, error)
        if (active) setInfoError(true)
      })
    return () => { active = false }
  }, [modelKey, cropName, district])

  const isBn = lang === 'bn'
  const label = modelName || info?.model_name || (isBn ? 'AI মডেল' : 'AI model')
  const notEvaluated = isBn ? 'মূল্যায়ন করা হয়নি' : 'not evaluated'

  return (
    <section className="ai-model-disclosure" aria-label={isBn ? 'মডেল তথ্য' : 'Model information'}>
      <div className="ai-model-disclosure-heading">
        <strong>{isBn ? 'মডেল:' : 'Model:'} {label}</strong>
        {lowConfidence && (
          <span className="ai-low-confidence">
            {isBn ? 'কম নির্ভরযোগ্যতা' : 'Low confidence'}
          </span>
        )}
      </div>
      {message && <p className="ai-model-disclosure-message">{message}</p>}
      <p className="ai-estimate-note">
        Estimate, not a guarantee. / এটি একটি আনুমানিক হিসাব, নিশ্চয়তা নয়।
      </p>
      <details>
        <summary>{isBn ? 'আরও জানুন' : 'Learn more'}</summary>
        {infoError ? (
          <p>{isBn ? 'মডেলের তথ্য লোড করা যায়নি।' : 'Model information could not be loaded.'}</p>
        ) : !info ? (
          <p>{isBn ? 'মডেলের তথ্য লোড হচ্ছে…' : 'Loading model information…'}</p>
        ) : (
          <dl className="ai-model-info-list">
            <dt>{isBn ? 'অ্যালগরিদম' : 'Algorithm'}</dt>
            <dd>{info.algorithm}</dd>
            <dt>{isBn ? 'প্রশিক্ষণ ডেটা' : 'Training data source'}</dt>
            <dd>{info.training_data_source}</dd>
            {info.data_provenance_note && (
              <>
                <dt>{isBn ? 'ডেটার সীমাবদ্ধতা' : 'Data limitation'}</dt>
                <dd>{info.data_provenance_note}</dd>
              </>
            )}
            <dt>{isBn ? 'প্রশিক্ষণের তারিখ' : 'Training date'}</dt>
            <dd>{info.training_date || (isBn ? 'অজানা' : 'unknown')}</dd>
            <dt>{isBn ? 'মূল্যায়ন' : 'Evaluation metrics'}</dt>
            <dd>
              {typeof info.evaluation_metrics === 'string'
                ? (info.evaluation_metrics === 'not evaluated' ? notEvaluated : info.evaluation_metrics)
                : Object.entries(info.evaluation_metrics || {}).map(([name, value]) => (
                    <span key={name}>
                      {name}: {typeof value === 'number' ? value.toFixed(2) : JSON.stringify(value)}{' '}
                    </span>
                  ))}
            </dd>
          </dl>
        )}
      </details>
    </section>
  )
}
