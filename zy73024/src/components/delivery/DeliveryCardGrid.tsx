import { deliveryCards } from '../../data/mockTraces'
import DeliveryCard from './DeliveryCard'

export default function DeliveryCardGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {deliveryCards.map((card, idx) => (
        <DeliveryCard key={card.id} card={card} index={idx} />
      ))}
    </div>
  )
}
