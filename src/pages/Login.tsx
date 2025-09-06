import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, where, collection, getDocs, updateDoc } from 'firebase/firestore';
import { getAuthInstance, getFirestoreInstance, setupRecaptcha } from '../config/firebase';
import { saveAuthState } from '../utils/authPersistence';
import { toast } from 'react-toastify';
import PhoneInput from 'react-phone-input-2';
import OtpInput from 'react-otp-input';

const Login: React.FC = () => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'employee' | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const role = searchParams.get('role');
    if (role === 'admin' || role === 'employee') {
      setSelectedRole(role);
    }
  }, [searchParams]);

  const sendOTP = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      // Preserve any existing auth state before reCAPTCHA
      console.log('🔐 Preserving auth state before OTP send');
      
      const authInstance = await getAuthInstance();
      const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
      
      console.log('📱 Sending OTP to:', `+${phoneNumber}`);
      const confirmation = await signInWithPhoneNumber(
        authInstance, 
        `+${phoneNumber}`, 
        recaptchaVerifier
      );
      
      setConfirmationResult(confirmation);
      setStep('otp');
      toast.success('Code sent!');
      
      console.log('✅ OTP sent successfully');
    } catch (error: any) {
      console.error('❌ Error sending OTP:', error);
      toast.error('Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!confirmationResult || !otp) {
      toast.error('Please enter the code');
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Confirming OTP...');
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      console.log('✅ OTP confirmed, user:', user.uid);
      
      const dbInstance = await getFirestoreInstance();
      
      // Look up user by phone number (which is now the document ID)
      const phoneDocRef = doc(dbInstance, 'users', user.phoneNumber);
      const phoneDoc = await getDoc(phoneDocRef);
      
      let userData: any = {};
      
      if (phoneDoc.exists()) {
        userData = phoneDoc.data();
        console.log('✅ Found user by phone number:', {
          role: userData.role,
          organizationId: userData.organizationId,
          displayName: userData.displayName
        });
        
        // Update the document with the actual Firebase UID
        try {
          console.log('📝 Updating document with Firebase UID...');
          await updateDoc(phoneDocRef, {
            uid: user.uid,
            updatedAt: serverTimestamp()
          });
          console.log('✅ Document updated with Firebase UID');
        } catch (updateError) {
          console.error('❌ Failed to update with UID:', updateError);
        }
        
        // Save the final user state
        const userStateData = {
          uid: user.uid,
          phoneNumber: user.phoneNumber || `+${phoneNumber}`,
          role: userData.role,
          organizationId: userData.organizationId,
          displayName: userData.displayName,
          createdAt: userData.createdAt,
        };
        
        console.log('💾 Saving final auth state:', {
          role: userStateData.role,
          organizationId: userStateData.organizationId
        });
        saveAuthState(userStateData);
        
        if (userData.role === 'admin') {
          if (userData.organizationId) {
            navigate('/admin/dashboard');
          } else {
            navigate('/admin/setup');
          }
        } else {
          console.log('🚀 Navigating to employee dashboard with orgId:', userData.organizationId);
          navigate('/employee/dashboard');
        }
      } else {
        // New user - create with selected role from URL
        if (selectedRole) {
          await createUserWithRole(user, selectedRole);
        } else {
          toast.error('Role not specified');
          navigate('/');
        }
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast.error('Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const createUserWithRole = async (user: any, role: 'admin' | 'employee') => {
    try {
      const dbInstance = await getFirestoreInstance();
      const userData = {
        uid: user.uid,
        phoneNumber: user.phoneNumber || `+${phoneNumber}`,
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(dbInstance, 'users', user.uid), userData);
      
      // IMMEDIATELY save auth state to localStorage
      const userStateData = {
        uid: user.uid,
        phoneNumber: user.phoneNumber || `+${phoneNumber}`,
        role: role,
        organizationId: '',
        displayName: '',
        createdAt: null,
      };
      saveAuthState(userStateData);
      
      if (role === 'admin') {
        navigate('/admin/setup');
      } else {
        navigate('/employee/dashboard');
      }
      
      toast.success('Registration complete');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Registration failed');
    }
  };


  const renderPhone = () => (
    <div>
      <h2 className="login-title">{selectedRole === 'admin' ? 'Admin Login' : selectedRole === 'employee' ? 'Employee Login' : 'F2P Buddy'}</h2>
      <p className="login-subtitle">Enter your phone number</p>
      
      <div className="form-group">
        <label className="form-label">Phone Number</label>
        <PhoneInput
          country={'in'}
          value={phoneNumber}
          onChange={setPhoneNumber}
          inputProps={{
            inputMode: 'tel',
            pattern: '[0-9]*',
            autoComplete: 'tel'
          }}
          inputStyle={{ 
            width: '100%', 
            height: '48px',
            fontSize: '16px', // Prevents zoom on iOS
            border: '1px solid #cbd5e0',
            borderRadius: '8px',
            paddingLeft: '50px'
          }}
          containerStyle={{ width: '100%' }}
          buttonStyle={{
            border: '1px solid #cbd5e0',
            borderRadius: '8px 0 0 8px',
            background: '#f7fafc'
          }}
        />
      </div>
      
      <button 
        className="btn" 
        onClick={sendOTP}
        disabled={!phoneNumber || loading}
      >
        {loading ? 'Sending...' : 'Send Code'}
      </button>
      
      <div id="recaptcha-container"></div>
    </div>
  );

  const renderOTP = () => (
    <div>
      <h2 className="login-title">Verify</h2>
      <p className="login-subtitle">Enter code sent to +{phoneNumber}</p>
      
      <div className="form-group">
        <div className="otp-container">
          <OtpInput
            value={otp}
            onChange={setOtp}
            numInputs={6}
            renderInput={(props) => (
              <input 
                {...props} 
                inputMode="numeric" 
                pattern="[0-9]*"
                autoComplete="one-time-code"
              />
            )}
          />
        </div>
      </div>
      
      <button 
        className="btn" 
        onClick={verifyOTP}
        disabled={otp.length !== 6 || loading}
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>
      
      <button 
        className="btn-secondary" 
        onClick={() => window.location.reload()}
        style={{ marginTop: '12px' }}
      >
        Change Number
      </button>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        {step === 'phone' && renderPhone()}
        {step === 'otp' && renderOTP()}
      </div>
    </div>
  );
};

export default Login;