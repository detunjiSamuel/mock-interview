"use client"
import Err from '@/app/components/err/err';
import Link from 'next/link'

import { redirect, useRouter } from 'next/navigation'


import { useState, useEffect } from 'react';


import { MAIN_API_URL, useAuth } from '@/app/AuthContext.tsx';

const defaultErr = {
 msg: undefined,
 err: undefined
}


export default function Home() {


 const authHook = useAuth();

 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');

 const [err, setErr] = useState({ ...defaultErr });


 const loginRequest = async () => {
  const res = await fetch(MAIN_API_URL + '/api/auth/login', {
   cache: 'no-store',
   method: 'POST',
   headers: {
    "Content-Type": "application/json",
   },
   body: JSON.stringify({
    email,
    password
   })
  }
  )
  const data = await res.json()
  console.log(data)

  if (!res.ok)
   setErr({
    msg: data.msg,
    err: data.err
   })

  else
   return data
 }


 const handleSubmit = async (e) => {
  e.preventDefault();

  const userDetails = await loginRequest()

  if (!userDetails) {
   setTimeout(() => {
    setErr({
     ...defaultErr
    });
   }, 1000);

   return
  }
  authHook.login(userDetails.token, userDetails.email)
 };


 return (
  authHook.isLoggedIn ? (redirect('/')) : (
   <main className='flex min-h-screen justify-center items-center'>
    <div className=" m-4">
     <form
      onSubmit={handleSubmit}
     >
      <div className="">
       <h2 className="text-center font-mono text-2xl font-bold text-gray-800 mb-6">
        Log in to your account
       </h2>
       <div className="font-mono text-xl font-bold text-gray-800 mb-6 text-center">
        Don't have an account? <Link href="/auth/register" className='underline hover:no-underline'>Sign up</Link>
       </div>

       {
        err.msg && <Err msg={err.msg} err={err.err} />
       }

      </div>

      <div className="mb-4">
       <label
        htmlFor="email"
        className="block text-gray-800 font-semibold mb-1"
       >
        Email
       </label>
       <input
        type="email"
        id="email"
        className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:border-indigo-500"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
       />
      </div>
      <div className="mb-6">
       <label
        htmlFor="password"
        className="block text-gray-800 font-semibold mb-1"
       >
        Password
       </label>
       <input
        type="password"
        id="password"
        className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:border-indigo-500"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
       />
      </div>

      <div className='flex justify-center items-center'>
       <button
        type="submit"
        className="bg-black hover:bg-red-300 text-white font-semibold py-2 px-4 rounded-md items-center w-full"
       >
        sign in
       </button>
      </div>

     </form>
    </div>

   </main>
  )
 );
}
