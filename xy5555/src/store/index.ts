import { createStore, combineReducers, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import plansReducer from './reducers/plansReducer';
import userReducer from './reducers/userReducer';
import comparisonReducer from './reducers/comparisonReducer';
import favoritesReducer from './reducers/favoritesReducer';

const rootReducer = combineReducers({
  plans: plansReducer,
  user: userReducer,
  comparison: comparisonReducer,
  favorites: favoritesReducer
});

export type RootState = ReturnType<typeof rootReducer>;

const store = createStore(
  rootReducer,
  applyMiddleware(thunk)
);

export default store;
