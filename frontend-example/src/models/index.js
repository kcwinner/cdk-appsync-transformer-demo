// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { Customer, Product, Order } = initSchema(schema);

export {
  Customer,
  Product,
  Order
};