import { GameEvent, GameState, EventChoice } from '../types';
import { useGameStore } from '../store/gameStore';

interface EventModalProps {
  event: GameEvent;
  gameState: GameState;
}

const EventModal = ({ event, gameState }: EventModalProps) => {
  const { handleEventChoice, isLoading } = useGameStore();

  const canChoose = (choice: EventChoice): boolean => {
    if (!choice.requirements) return true;

    if (choice.requirements.resources) {
      for (const [key, value] of Object.entries(choice.requirements.resources)) {
        const resourceKey = key as keyof typeof gameState.resources;
        if (gameState.resources[resourceKey] < (value as number)) {
          return false;
        }
      }
    }

    if (choice.requirements.inventory) {
      for (const req of choice.requirements.inventory) {
        const item = gameState.inventory.find((i) => i.id === req.itemId);
        if (!item || item.quantity < req.quantity) {
          return false;
        }
      }
    }

    if (choice.requirements.facility) {
      const facility = gameState.facilities.find(
        (f) => f.id === choice.requirements!.facility!.facilityId
      );
      if (!facility || facility.level < choice.requirements.facility.minLevel) {
        return false;
      }
    }

    return true;
  };

  const getEventTypeLabel = () => {
    const labels: Record<GameEvent['type'], string> = {
      storm: '🌩️ 暴风雨',
      disease: '🤒 疾病',
      wreck: '⚓ 沉船补给',
      footprints: '👣 神秘脚印',
      friday: '👤 星期五',
      rescue: '🚢 救援',
      random: '❓ 随机事件',
    };
    return labels[event.type];
  };

  const getEventTypeColor = () => {
    const colors: Record<GameEvent['type'], string> = {
      storm: 'bg-blue-600',
      disease: 'bg-red-600',
      wreck: 'bg-amber-600',
      footprints: 'bg-green-600',
      friday: 'bg-purple-600',
      rescue: 'bg-emerald-600',
      random: 'bg-gray-600',
    };
    return colors[event.type];
  };

  return (
    <div className="event-modal">
      <div className="event-content">
        <div className={`${getEventTypeColor()} text-white p-6 rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getEventTypeLabel().split(' ')[0]}</span>
            <div>
              <span className="text-sm opacity-80">事件</span>
              <h2 className="text-2xl font-bold">{event.name}</h2>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-700 text-lg mb-6 leading-relaxed">
            {event.description}
          </p>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800 mb-2">你要如何应对？</h3>
            {event.choices.map((choice) => {
              const canDo = canChoose(choice);
              return (
                <button
                  key={choice.id}
                  onClick={() => handleEventChoice(event.id, choice.id)}
                  disabled={!canDo || isLoading}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    canDo
                      ? 'bg-white border-gray-200 hover:border-ocean hover:shadow-md'
                      : 'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <h4 className="font-semibold text-gray-800">{choice.text}</h4>
                  {choice.requirements && (
                    <div className="mt-2 text-xs text-gray-500">
                      {choice.requirements.facility && (
                        <span className="mr-2">
                          需要设施: {choice.requirements.facility.facilityId} ≥{' '}
                          {choice.requirements.facility.minLevel}级
                        </span>
                      )}
                      {choice.requirements.resources &&
                        Object.entries(choice.requirements.resources).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            需要 {key}: {value}
                          </span>
                        ))}
                      {choice.requirements.inventory?.map((item) => (
                        <span key={item.itemId} className="mr-2">
                          需要 {item.itemId} x{item.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                  {!canDo && (
                    <p className="text-xs text-red-500 mt-1">条件不足</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
