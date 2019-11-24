
// Take a list of uri path components, and concat them to a single uri path. 
export const concatUri = (parts : string[]) => parts
    .filter(part => part !== '')
    .map((part, index) => {
        let partTrimmed = part;
        partTrimmed = partTrimmed.replace(/[/]*$/, ''); // Remove trailing slashes
        
        if (index > 0) {
            partTrimmed = partTrimmed.replace(/^[/]*/, ''); // Remove leading slashes
        } else {
            partTrimmed = partTrimmed.replace(/[/]+$/, '/'); // Deduplicate leading slashes
        }
        
        return partTrimmed;
    })
    .join('/');
