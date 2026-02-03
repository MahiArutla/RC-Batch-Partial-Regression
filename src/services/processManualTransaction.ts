import { manualTransaction } from '../services/manualProcessingApi';
import { generateRegistrationNumber } from '../utils/registrationNumber';
import { FileDetails } from '../models/fileDetails';

/**
 * Calls the manual processing API for a given jurisdiction and fileDetails.
 * @param fileDetails FileDetails object with orderId
 * @param jurisdiction Jurisdiction string (e.g., 'QC', 'AB', etc.)
 * @param apiUser API user string
 */
export async function processManualTransaction(fileDetails: FileDetails, jurisdiction: string, apiUser: string) {
  if (!fileDetails.orderId) throw new Error('orderId is required in fileDetails');
  const registrationNumber = generateRegistrationNumber(jurisdiction);
  fileDetails.baseRegistrationNum = registrationNumber;
  const uri = 'http://aqa1publicapiwebsvcs.cge.dhltd.corp/api/ManualProcessing';
  const request = {
    orderId: Number(fileDetails.orderId),
    registrationNumber,
  };
  const response = await manualTransaction(uri, request, apiUser);
  return response;
}
