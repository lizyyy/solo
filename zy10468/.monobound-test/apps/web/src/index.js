import { sharedUtil } from '@test/shared';
import { Button } from '@test/ui';
import { fetchData } from '@test/api';

export const config = {
  theme: 'dark',
};

export function App() {
  return (
    <div>
      <Button />
      {sharedUtil()}
      {fetchData()}
    </div>
  );
}
