import { useExposureStore } from '@/store/exposureStore'

export default function CurrencyFilter() {
  const currencies = useExposureStore((s) => s.currencies)
  const subsidiaries = useExposureStore((s) => s.subsidiaries)
  const selectedCurrencies = useExposureStore((s) => s.selectedCurrencies)
  const selectedSubsidiaries = useExposureStore((s) => s.selectedSubsidiaries)
  const selectedDirections = useExposureStore((s) => s.selectedDirections)
  const setSelectedCurrencies = useExposureStore((s) => s.setSelectedCurrencies)
  const setSelectedSubsidiaries = useExposureStore((s) => s.setSelectedSubsidiaries)
  const setSelectedDirections = useExposureStore((s) => s.setSelectedDirections)

  const toggleCurrency = (code: string) => {
    if (selectedCurrencies.includes(code)) {
      setSelectedCurrencies(selectedCurrencies.filter((c) => c !== code))
    } else {
      setSelectedCurrencies([...selectedCurrencies, code])
    }
  }

  const toggleSubsidiary = (id: string) => {
    if (selectedSubsidiaries.includes(id)) {
      setSelectedSubsidiaries(selectedSubsidiaries.filter((s) => s !== id))
    } else {
      setSelectedSubsidiaries([...selectedSubsidiaries, id])
    }
  }

  const toggleDirection = (dir: string) => {
    if (selectedDirections.includes(dir)) {
      setSelectedDirections(selectedDirections.filter((d) => d !== dir))
    } else {
      setSelectedDirections([...selectedDirections, dir])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-txt-secondary mb-2 font-medium">币种筛选</div>
        <div className="flex flex-wrap gap-2">
          {currencies.map((c) => (
            <span
              key={c.code}
              className={`tag ${selectedCurrencies.includes(c.code) ? 'tag-active' : 'tag-inactive'}`}
              onClick={() => toggleCurrency(c.code)}
            >
              {c.code}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-txt-secondary mb-2 font-medium">子公司筛选</div>
        <div className="flex flex-wrap gap-2">
          {subsidiaries.map((s) => (
            <span
              key={s.id}
              className={`tag ${selectedSubsidiaries.includes(s.id) ? 'tag-active' : 'tag-inactive'}`}
              onClick={() => toggleSubsidiary(s.id)}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-txt-secondary mb-2 font-medium">方向筛选</div>
        <div className="flex gap-2">
          {['LONG', 'SHORT'].map((dir) => (
            <span
              key={dir}
              className={`tag ${selectedDirections.includes(dir) ? (dir === 'LONG' ? 'tag-active' : 'bg-accent-red/15 text-accent-red border border-accent-red/30') : 'tag-inactive'}`}
              onClick={() => toggleDirection(dir)}
            >
              {dir === 'LONG' ? '多头' : '空头'}
            </span>
          ))}
        </div>
      </div>
      <button
        className="btn-secondary text-xs"
        onClick={() => {
          setSelectedCurrencies([])
          setSelectedSubsidiaries([])
          setSelectedDirections([])
        }}
      >
        清除筛选
      </button>
    </div>
  )
}
