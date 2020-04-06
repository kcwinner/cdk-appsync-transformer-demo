import React, { useState, useEffect } from 'react';
import './App.css';

import Amplify from 'aws-amplify';

import { DataStore, Predicates } from '@aws-amplify/datastore'
import { Customer, Product } from './models';

import awsconfig from './aws-exports';
Amplify.configure(awsconfig);

function App() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const updateCustomers = async (setCustomers) => {
    const updatedCustomers = await DataStore.query(Customer, Predicates.All);
    setCustomers(updatedCustomers);
  }

  const updateProducts = async (setProducts) => {
    const updatedProducts = await DataStore.query(Product, Predicates.All);
    setProducts(updatedProducts);
  }

  useEffect(() => {
    const fetchCustomers = async () => {
      const customers = await DataStore.query(Customer, Predicates.All);
      setCustomers(customers);
    }

    fetchCustomers();

    const customerSubscription = DataStore.observe(Customer).subscribe(() => {
      updateCustomers(setCustomers);
    })

    const productSubscription = DataStore.observe(Product).subscribe(() => {
      updateProducts(setProducts);
    })


    return () => {
      customerSubscription.unsubscribe();
      productSubscription.unsubscribe();
    }
  }, [])

  return (
    <div className="App">
      <header>
        <h2>React Example</h2>
      </header>

      <CustomersTable customers={customers} />

      <br />

      <ProductsTable products={products} />
    </div>
  );
}

export default App;

function CustomersTable({ customers }) {

  const addCustomer = async () => {
    let customer = await DataStore.save(
      new Customer({
        firstName: 'Greatest',
        lastName: 'Example',
        active: true,
        address: '1600 Joshua Lane'
      })
    );

    console.log(customer);
  }

  return (
    <>
      <h3>Customers</h3>
      <button onClick={addCustomer}>Add Customer</button>
      <table>
        <thead>
          <tr>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Active</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {
            customers.map(customer => {
              return (
                <tr key={customer.id}>
                  <td>{customer.firstName}</td>
                  <td>{customer.lastName}</td>
                  <td>{customer.active.toString()}</td>
                  <td>{customer.address}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </>
  )
}

function ProductsTable({ products }) {

  const addProduct = async () => {
    let product = await DataStore.save(
      new Product({
        name: 'Water Bottle',
        description: 'Example product',
        price: '$2.00',
        active: true,
        added: new Date().toISOString()
      })
    );

    console.log(product);
  }

  return (
    <>
      <h3>Products</h3>
      <button onClick={addProduct}>Add Product</button>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Price</th>
            <th>Active</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {
            products.map(product => {
              return (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.description}</td>
                  <td>{product.price}</td>
                  <td>{product.active.toString()}</td>
                  <td>{product.added}</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </>
  )
}