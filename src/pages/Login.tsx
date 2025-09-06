import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuthInstance, getFirestoreInstance, setupRecaptcha } from '../config/firebase';
import { toast } from 'react-toastify';
import PhoneInput from 'react-phone-input-2';
import OtpInput from 'react-otp-input';

const Login: React.FC = () => {
  const [step, setStep] = useState<'phone' | 'otp' | 'role'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendOTP = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const authInstance = await getAuthInstance();
      const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
      const confirmation = await signInWithPhoneNumber(
        authInstance, 
        `+${phoneNumber}`, 
        recaptchaVerifier
      );
      
      setConfirmationResult(confirmation);
      setStep('otp');
      toast.success('Code sent!');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
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
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      
      const dbInstance = await getFirestoreInstance();
      const userDocRef = doc(dbInstance, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.role === 'admin') {
          if (userData.organizationId) {
            navigate('/admin/dashboard');
          } else {
            navigate('/admin/setup');
          }
        } else {
          navigate('/employee/dashboard');
        }
      } else {
        setStep('role');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast.error('Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role: 'admin' | 'employee') => {
    const authInstance = await getAuthInstance();
    const user = authInstance.currentUser;
    if (!user) {
      toast.error('Authentication error');
      return;
    }

    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      await setDoc(doc(dbInstance, 'users', user.uid), {
        uid: user.uid,
        phoneNumber: user.phoneNumber || `+${phoneNumber}`,
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      if (role === 'admin') {
        navigate('/admin/setup');
      } else {
        navigate('/employee/dashboard');
      }
      
      toast.success('Registration complete');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderPhone = () => (
    <div>
      <h2 className="login-title">F2P Buddy</h2>
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

  const renderRole = () => (
    <div>
      <h2 className="login-title">Select Role</h2>
      
      <div className="role-selection">
        <div className="role-btn" onClick={() => selectRole('admin')}>
          <div className="role-icon">👨‍💼</div>
          <h3>Admin</h3>
        </div>
        
        <div className="role-btn" onClick={() => selectRole('employee')}>
          <div className="role-icon">👥</div>
          <h3>Employee</h3>
        </div>
      </div>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        {step === 'phone' && renderPhone()}
        {step === 'otp' && renderOTP()}
        {step === 'role' && renderRole()}
      </div>
    </div>
  );
};

export default Login;