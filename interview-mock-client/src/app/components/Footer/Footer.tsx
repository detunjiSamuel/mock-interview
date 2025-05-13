'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Interview Practice</h2>
            <p className="text-gray-600 text-sm">
              Helping new graduates prepare for interviews and land their dream jobs with confidence.
            </p>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/resources/tips" className="text-gray-600 hover:text-gray-900 text-sm">
                  Interview Tips
                </Link>
              </li>
              <li>
                <Link href="/resources/resume" className="text-gray-600 hover:text-gray-900 text-sm">
                  Resume Building
                </Link>
              </li>
              <li>
                <Link href="/resources/behavioral" className="text-gray-600 hover:text-gray-900 text-sm">
                  Behavioral Questions
                </Link>
              </li>
              <li>
                <Link href="/resources/technical" className="text-gray-600 hover:text-gray-900 text-sm">
                  Technical Questions
                </Link>
              </li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              Company
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-600 hover:text-gray-900 text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-600 hover:text-gray-900 text-sm">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-gray-900 text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-600 hover:text-gray-900 text-sm">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              Connect
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="https://twitter.com/interviewpractice" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 text-sm">
                  Twitter
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/company/interviewpractice" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 text-sm">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://github.com/interviewpractice" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 text-sm">
                  GitHub
                </a>
              </li>
              <li>
                <a href="mailto:info@interviewpractice.com" className="text-gray-600 hover:text-gray-900 text-sm">
                  Email Us
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 border-t border-gray-200 pt-8 flex flex-col items-center">
          <p className="text-sm text-gray-500">
            &copy; {currentYear} Interview Practice. All rights reserved.
          </p>
          <div className="mt-2 flex space-x-6">
            <Link href="/privacy" className="text-gray-500 hover:text-gray-900 text-xs">
              Privacy
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-gray-900 text-xs">
              Terms
            </Link>
            <Link href="/sitemap" className="text-gray-500 hover:text-gray-900 text-xs">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}