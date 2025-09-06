const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
const serviceAccount = require('/Users/sumitjha/Dropbox/Mac/Documents/Projects/Creds/f2p-buddy-1756234727-firebase-adminsdk-fbsvc-de30a63a2f.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'f2p-buddy-1756234727'
});

const db = getFirestore();

async function initializeDatabase() {
  console.log('🔥 Initializing F2P Buddy database...');

  try {
    // Get the authenticated user ID from Firebase Auth
    // Since we know a user authenticated with phone +918422994352
    const userId = '7sms9eDsMuUt8IjjoggDsX6J75y2'; // This is from your console logs
    
    // 1. Create/Update the user document with admin role
    console.log('👤 Creating admin user document...');
    await db.collection('users').doc(userId).set({
      uid: userId,
      phoneNumber: '+918422994352',
      role: 'admin',
      displayName: 'Admin User',
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    console.log('✅ Admin user created');

    // 2. Create a sample organization
    console.log('🏢 Creating sample organization...');
    const orgRef = await db.collection('organizations').add({
      name: 'Demo Organization',
      primaryColor: '#667eea',
      secondaryColor: '#764ba2',
      adminId: userId,
      settings: {
        allowSelfRegistration: true,
        requireApproval: false,
        timezone: 'Asia/Kolkata'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Sample organization created:', orgRef.id);

    // 3. Update user with organization ID
    console.log('🔗 Linking user to organization...');
    await db.collection('users').doc(userId).update({
      organizationId: orgRef.id,
      updatedAt: new Date()
    });
    console.log('✅ User linked to organization');

    // 4. Create a sample campaign
    console.log('🎯 Creating sample campaign...');
    const campaignRef = await db.collection('campaigns').add({
      name: 'Q4 Sales Challenge',
      description: 'Boost your sales performance this quarter and win exciting prizes!',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: ['sales', 'calls'],
      metrics: {
        sales: { target: 100000, achieved: 0 },
        calls: { target: 200, achieved: 0 }
      },
      prizes: [
        { position: 1, title: 'Gold Prize', description: '₹50,000 cash reward' },
        { position: 2, title: 'Silver Prize', description: '₹30,000 cash reward' },
        { position: 3, title: 'Bronze Prize', description: '₹20,000 cash reward' }
      ],
      participants: [],
      orgId: orgRef.id,
      createdBy: userId,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Sample campaign created:', campaignRef.id);

    // 5. Create some sample achievements
    console.log('🏆 Creating sample achievements...');
    const achievementRef = await db.collection('achievements').add({
      userId: userId,
      campaignId: campaignRef.id,
      type: 'sales',
      value: 25000,
      description: 'Closed ₹25,000 in sales',
      dateAchieved: new Date().toISOString(),
      verified: true,
      verifiedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Sample achievement created:', achievementRef.id);

    // 6. Create some sample employees
    console.log('👥 Creating sample employees...');
    const employeeUsers = [
      {
        uid: 'emp1_sample',
        phoneNumber: '+918422994353',
        role: 'employee',
        displayName: 'John Smith',
        organizationId: orgRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        uid: 'emp2_sample',
        phoneNumber: '+918422994354',
        role: 'employee',
        displayName: 'Sarah Johnson',
        organizationId: orgRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const employee of employeeUsers) {
      await db.collection('users').doc(employee.uid).set(employee);
      console.log(`✅ Sample employee created: ${employee.displayName}`);
    }

    // 7. Verify collections exist
    console.log('🔍 Verifying database structure...');
    const collections = ['users', 'organizations', 'campaigns', 'achievements'];
    
    for (const collection of collections) {
      const snapshot = await db.collection(collection).limit(1).get();
      console.log(`✅ ${collection} collection: ${snapshot.size} documents`);
    }

    console.log('');
    console.log('🎉 DATABASE INITIALIZATION COMPLETE!');
    console.log('');
    console.log('✅ Your F2P Buddy database is now ready with:');
    console.log('   - Admin user with phone +918422994352');
    console.log('   - Demo organization with branding');
    console.log('   - Sample campaign ready to activate');
    console.log('   - Sample achievements for testing');
    console.log('   - Sample employees for demonstration');
    console.log('');
    console.log('🚀 Go back to your app and refresh - it should work now!');
    console.log('🌐 https://f2p-buddy.netlify.app');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the initialization
initializeDatabase();