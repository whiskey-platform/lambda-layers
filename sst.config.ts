import { SSTConfig } from 'sst';
import { Layers } from './stacks/MyStack';

export default {
  config(_input) {
    return {
      name: 'lambda-layers',
      region: 'us-east-1',
    };
  },
  stacks(app) {
    app.stack(Layers);
  },
} satisfies SSTConfig;
