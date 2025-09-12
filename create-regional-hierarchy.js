const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require('/Users/sumitjha/Dropbox/Mac/Documents/Projects/Creds/f2p-buddy-1756234727-firebase-adminsdk-fbsvc-de30a63a2f.json');

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'f2p-buddy-1756234727'
});

const db = getFirestore();

// Regional hierarchy data based on the Excel file
const hierarchyData = {
  North: {
    clusters: {
      NC1: {
        branches: ['NC1_BR1', 'NC1_BR2', 'NC1_BR3'],
        channels: {
          NC1_BR1: ['NC1_BR1_CH1', 'NC1_BR1_CH2', 'NC1_BR1_CH3', 'NC1_BR1_CH4'],
          NC1_BR2: ['NC1_BR2_CH1', 'NC1_BR2_CH2', 'NC1_BR2_CH3', 'NC1_BR2_CH4'],
          NC1_BR3: ['NC1_BR3_CH1', 'NC1_BR3_CH2', 'NC1_BR3_CH3', 'NC1_BR3_CH4']
        }
      },
      NC2: {
        branches: ['NC2_BR1', 'NC2_BR2', 'NC2_BR3'],
        channels: {
          NC2_BR1: ['NC2_BR1_CH1', 'NC2_BR1_CH2', 'NC2_BR1_CH3', 'NC2_BR1_CH4'],
          NC2_BR2: ['NC2_BR2_CH1', 'NC2_BR2_CH2', 'NC2_BR2_CH3', 'NC2_BR2_CH4'],
          NC2_BR3: ['NC2_BR3_CH1', 'NC2_BR3_CH2', 'NC2_BR3_CH3', 'NC2_BR3_CH4']
        }
      },
      NC3: {
        branches: ['NC3_BR1', 'NC3_BR2', 'NC3_BR3'],
        channels: {
          NC3_BR1: ['NC3_BR1_CH1', 'NC3_BR1_CH2', 'NC3_BR1_CH3', 'NC3_BR1_CH4'],
          NC3_BR2: ['NC3_BR2_CH1', 'NC3_BR2_CH2', 'NC3_BR2_CH3', 'NC3_BR2_CH4'],
          NC3_BR3: ['NC3_BR3_CH1', 'NC3_BR3_CH2', 'NC3_BR3_CH3', 'NC3_BR3_CH4']
        }
      }
    }
  },
  South: {
    clusters: {
      SC1: {
        branches: ['SC1_BR1', 'SC1_BR2', 'SC1_BR3'],
        channels: {
          SC1_BR1: ['SC1_BR1_CH1', 'SC1_BR1_CH2', 'SC1_BR1_CH3', 'SC1_BR1_CH4'],
          SC1_BR2: ['SC1_BR2_CH1', 'SC1_BR2_CH2', 'SC1_BR2_CH3', 'SC1_BR2_CH4'],
          SC1_BR3: ['SC1_BR3_CH1', 'SC1_BR3_CH2', 'SC1_BR3_CH3', 'SC1_BR3_CH4']
        }
      },
      SC2: {
        branches: ['SC2_BR1', 'SC2_BR2', 'SC2_BR3'],
        channels: {
          SC2_BR1: ['SC2_BR1_CH1', 'SC2_BR1_CH2', 'SC2_BR1_CH3', 'SC2_BR1_CH4'],
          SC2_BR2: ['SC2_BR2_CH1', 'SC2_BR2_CH2', 'SC2_BR2_CH3', 'SC2_BR2_CH4'],
          SC2_BR3: ['SC2_BR3_CH1', 'SC2_BR3_CH2', 'SC2_BR3_CH3', 'SC2_BR3_CH4']
        }
      },
      SC3: {
        branches: ['SC3_BR1', 'SC3_BR2', 'SC3_BR3'],
        channels: {
          SC3_BR1: ['SC3_BR1_CH1', 'SC3_BR1_CH2', 'SC3_BR1_CH3', 'SC3_BR1_CH4'],
          SC3_BR2: ['SC3_BR2_CH1', 'SC3_BR2_CH2', 'SC3_BR2_CH3', 'SC3_BR2_CH4'],
          SC3_BR3: ['SC3_BR3_CH1', 'SC3_BR3_CH2', 'SC3_BR3_CH3', 'SC3_BR3_CH4']
        }
      }
    }
  },
  East: {
    clusters: {
      EC1: {
        branches: ['EC1_BR1', 'EC1_BR2', 'EC1_BR3'],
        channels: {
          EC1_BR1: ['EC1_BR1_CH1', 'EC1_BR1_CH2', 'EC1_BR1_CH3', 'EC1_BR1_CH4'],
          EC1_BR2: ['EC1_BR2_CH1', 'EC1_BR2_CH2', 'EC1_BR2_CH3', 'EC1_BR2_CH4'],
          EC1_BR3: ['EC1_BR3_CH1', 'EC1_BR3_CH2', 'EC1_BR3_CH3', 'EC1_BR3_CH4']
        }
      },
      EC2: {
        branches: ['EC2_BR1', 'EC2_BR2', 'EC2_BR3'],
        channels: {
          EC2_BR1: ['EC2_BR1_CH1', 'EC2_BR1_CH2', 'EC2_BR1_CH3', 'EC2_BR1_CH4'],
          EC2_BR2: ['EC2_BR2_CH1', 'EC2_BR2_CH2', 'EC2_BR2_CH3', 'EC2_BR2_CH4'],
          EC2_BR3: ['EC2_BR3_CH1', 'EC2_BR3_CH2', 'EC2_BR3_CH3', 'EC2_BR3_CH4']
        }
      },
      EC3: {
        branches: ['EC3_BR1', 'EC3_BR2', 'EC3_BR3'],
        channels: {
          EC3_BR1: ['EC3_BR1_CH1', 'EC3_BR1_CH2', 'EC3_BR1_CH3', 'EC3_BR1_CH4'],
          EC3_BR2: ['EC3_BR2_CH1', 'EC3_BR2_CH2', 'EC3_BR2_CH3', 'EC3_BR2_CH4'],
          EC3_BR3: ['EC3_BR3_CH1', 'EC3_BR3_CH2', 'EC3_BR3_CH3', 'EC3_BR3_CH4']
        }
      }
    }
  },
  West: {
    clusters: {
      WC1: {
        branches: ['WC1_BR1', 'WC1_BR2', 'WC1_BR3'],
        channels: {
          WC1_BR1: ['WC1_BR1_CH1', 'WC1_BR1_CH2', 'WC1_BR1_CH3', 'WC1_BR1_CH4'],
          WC1_BR2: ['WC1_BR2_CH1', 'WC1_BR2_CH2', 'WC1_BR2_CH3', 'WC1_BR2_CH4'],
          WC1_BR3: ['WC1_BR3_CH1', 'WC1_BR3_CH2', 'WC1_BR3_CH3', 'WC1_BR3_CH4']
        }
      },
      WC2: {
        branches: ['WC2_BR1', 'WC2_BR2', 'WC2_BR3'],
        channels: {
          WC2_BR1: ['WC2_BR1_CH1', 'WC2_BR1_CH2', 'WC2_BR1_CH3', 'WC2_BR1_CH4'],
          WC2_BR2: ['WC2_BR2_CH1', 'WC2_BR2_CH2', 'WC2_BR2_CH3', 'WC2_BR2_CH4'],
          WC2_BR3: ['WC2_BR3_CH1', 'WC2_BR3_CH2', 'WC2_BR3_CH3', 'WC2_BR3_CH4']
        }
      },
      WC3: {
        branches: ['WC3_BR1', 'WC3_BR2', 'WC3_BR3'],
        channels: {
          WC3_BR1: ['WC3_BR1_CH1', 'WC3_BR1_CH2', 'WC3_BR1_CH3', 'WC3_BR1_CH4'],
          WC3_BR2: ['WC3_BR2_CH1', 'WC3_BR2_CH2', 'WC3_BR2_CH3', 'WC3_BR2_CH4'],
          WC3_BR3: ['WC3_BR3_CH1', 'WC3_BR3_CH2', 'WC3_BR3_CH3', 'WC3_BR3_CH4']
        }
      }
    }
  }
};

// Function to generate hierarchy structure for OrganizationSettings format
function generateHierarchyLevels() {
  const levels = [
    { id: '1', name: 'Region', level: 1, items: [] },
    { id: '2', name: 'Cluster', level: 2, items: [] },
    { id: '3', name: 'Branch', level: 3, items: [] },
    { id: '4', name: 'Channel', level: 4, items: [] }
  ];

  // Add regions (level 1)
  Object.keys(hierarchyData).forEach((regionName, index) => {
    levels[0].items.push({
      id: `region_${regionName.toLowerCase()}`,
      name: regionName,
      level: 1
    });

    // Add clusters (level 2)
    Object.keys(hierarchyData[regionName].clusters).forEach((clusterName, clusterIndex) => {
      levels[1].items.push({
        id: `cluster_${clusterName.toLowerCase()}`,
        name: clusterName,
        parentId: `region_${regionName.toLowerCase()}`,
        level: 2
      });

      // Add branches (level 3)
      hierarchyData[regionName].clusters[clusterName].branches.forEach((branchName, branchIndex) => {
        levels[2].items.push({
          id: `branch_${branchName.toLowerCase()}`,
          name: branchName,
          parentId: `cluster_${clusterName.toLowerCase()}`,
          level: 3
        });

        // Add channels (level 4)
        hierarchyData[regionName].clusters[clusterName].channels[branchName].forEach((channelName, channelIndex) => {
          levels[3].items.push({
            id: `channel_${channelName.toLowerCase()}`,
            name: channelName,
            parentId: `branch_${branchName.toLowerCase()}`,
            level: 4
          });
        });
      });
    });
  });

  return levels;
}

async function createRegionalHierarchy() {
  console.log('🚀 Creating regional hierarchy for organization tgZQ0zFlgjvJDgnGQlSd...');
  
  const organizationId = 'tgZQ0zFlgjvJDgnGQlSd';
  
  try {
    // Generate hierarchy levels
    const hierarchyLevels = generateHierarchyLevels();
    
    console.log('📊 Generated hierarchy structure:');
    console.log(`- ${hierarchyLevels[0].items.length} Regions`);
    console.log(`- ${hierarchyLevels[1].items.length} Clusters`);
    console.log(`- ${hierarchyLevels[2].items.length} Branches`);
    console.log(`- ${hierarchyLevels[3].items.length} Channels`);
    
    // Update the organization document
    const orgRef = db.collection('organizations').doc(organizationId);
    
    // Check if organization exists
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
      console.error('❌ Organization tgZQ0zFlgjvJDgnGQlSd not found');
      process.exit(1);
    }
    
    // Update with hierarchy levels
    await orgRef.update({
      hierarchyLevels: hierarchyLevels,
      updatedAt: new Date()
    });
    
    console.log('✅ Regional hierarchy created successfully!');
    console.log('');
    console.log('🎯 Hierarchy Summary:');
    console.log('├── North Region (NC1, NC2, NC3 clusters)');
    console.log('├── South Region (SC1, SC2, SC3 clusters)');
    console.log('├── East Region (EC1, EC2, EC3 clusters)');
    console.log('└── West Region (WC1, WC2, WC3 clusters)');
    console.log('');
    console.log('Each cluster has 3 branches, each branch has 4 channels');
    console.log('Total: 4 regions × 3 clusters × 3 branches × 4 channels = 144 organizational units');
    
    // Generate a CSV template for future uploads
    const csvContent = generateCSVTemplate(hierarchyLevels);
    fs.writeFileSync('/tmp/regional_hierarchy_template.csv', csvContent);
    console.log('📄 CSV template saved to /tmp/regional_hierarchy_template.csv');
    
  } catch (error) {
    console.error('❌ Error creating regional hierarchy:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

function generateCSVTemplate(hierarchyLevels) {
  const lines = ['Region,Cluster,Branch,Channel,Level,ParentId'];
  
  hierarchyLevels.forEach(level => {
    level.items.forEach(item => {
      const parentId = item.parentId || '';
      const levelName = level.name;
      
      if (level.level === 1) {
        lines.push(`${item.name},,,Channel,1,`);
      } else if (level.level === 2) {
        const parentRegion = hierarchyLevels[0].items.find(r => r.id === item.parentId);
        lines.push(`${parentRegion?.name || ''},${item.name},,Channel,2,${parentId}`);
      } else if (level.level === 3) {
        const parentCluster = hierarchyLevels[1].items.find(c => c.id === item.parentId);
        const grandParentRegion = hierarchyLevels[0].items.find(r => r.id === parentCluster?.parentId);
        lines.push(`${grandParentRegion?.name || ''},${parentCluster?.name || ''},${item.name},Channel,3,${parentId}`);
      } else if (level.level === 4) {
        const parentBranch = hierarchyLevels[2].items.find(b => b.id === item.parentId);
        const grandParentCluster = hierarchyLevels[1].items.find(c => c.id === parentBranch?.parentId);
        const greatGrandParentRegion = hierarchyLevels[0].items.find(r => r.id === grandParentCluster?.parentId);
        lines.push(`${greatGrandParentRegion?.name || ''},${grandParentCluster?.name || ''},${parentBranch?.name || ''},${item.name},4,${parentId}`);
      }
    });
  });
  
  return lines.join('\n');
}

// Run the initialization
createRegionalHierarchy();