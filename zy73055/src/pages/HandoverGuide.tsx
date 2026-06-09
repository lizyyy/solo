import { HandoverCards } from '../components/HandoverCards';

export default function HandoverGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <HandoverCards />
      </div>
    </div>
  );
}
